-- Harvest Platform — Phase 1 Foundation
-- Authoritative schema for spec v2.0 (project rjjhuugtwwimsijnmvwy).
-- Decision (Leo, June 30 2026): spec v2.0 is canonical. An earlier partial
-- Garden schema (sample data only) is dropped and rebuilt to match the spec.
--
-- DESTRUCTIVE: the drop block below removes all platform tables and their data.
-- This is intentional — only throwaway sample data existed. auth.users is NOT
-- touched. Re-running this file fully resets the schema.

-- ============================================================
-- DROP (clean rebuild — reverse dependency order, CASCADE for safety)
-- ============================================================
drop table if exists
  content_relationships, content_assignments, content_versions, content_published, content_calendar, content_items,
  messages, conversations,
  client_activity, shared_items, resources,
  notifications,
  email_templates, coupons, invoices, payments, contracts,
  survey_responses, survey_questions, surveys,
  bookings, availability_overrides, availability, coach_calendars,
  session_plan_topics, session_plans, session_notes, sessions, session_templates,
  clients, packages, coaches,
  templates, saved_views, kpi_widgets, item_relationships, items, sections, sub_tabs, tabs,
  app_settings, feature_flags
cascade;

-- profiles is dropped last (referenced by many). Its trigger on auth.users is recreated below.
drop table if exists profiles cascade;

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin','coach','client','user')),
  name text,
  email text,
  avatar_url text,
  phone text,
  settings jsonb not null default '{}'::jsonb,
  mode text not null default 'simple' check (mode in ('simple','guided','builder','custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile row on first login
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url, role, mode)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    case when new.email = 'harvestyourpassionllc@gmail.com' then 'admin' else 'user' end,
    'simple'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles for select
  using (auth.uid() = id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id);

-- ============================================================
-- ROOTS — Universal Item System
-- ============================================================
create table if not exists tabs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  order_index int not null default 0,
  promoted_from_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sub_tabs (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references tabs(id) on delete cascade,
  name text not null,
  mode text not null default 'manual' check (mode in ('auto','manual')),
  filter jsonb not null default '{}'::jsonb,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  sub_tab_id uuid not null references sub_tabs(id) on delete cascade,
  name text not null,
  type text not null default 'manual' check (type in ('manual','filtered','grouped','calculated','timeline','routine')),
  config jsonb not null default '{}'::jsonb,
  agg_field text,
  agg_op text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tab_id uuid references tabs(id) on delete set null,
  section_id uuid references sections(id) on delete set null,
  title text not null,
  type text not null,
  status text not null default 'Active',
  fields jsonb not null default '{}'::jsonb,
  sub_items jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  archived boolean not null default false,
  discuss_next_session boolean not null default false,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_items_user on items(user_id);
create index if not exists idx_items_tab on items(tab_id);

create table if not exists item_relationships (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  related_item_id uuid not null references items(id) on delete cascade,
  relationship_type text not null default 'related' check (relationship_type in ('supports','depends_on','belongs_to','related')),
  direction text not null default 'forward' check (direction in ('forward','bidirectional')),
  created_at timestamptz not null default now()
);

create table if not exists kpi_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  type text not null check (type in ('counter','total','progress','calculated')),
  filter jsonb not null default '{}'::jsonb,
  calc_formula text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tab_id uuid references tabs(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '{}'::jsonb,
  group_by text,
  created_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  structure jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tabs enable row level security;
alter table sub_tabs enable row level security;
alter table sections enable row level security;
alter table items enable row level security;
alter table item_relationships enable row level security;
alter table kpi_widgets enable row level security;
alter table saved_views enable row level security;
alter table templates enable row level security;

drop policy if exists "tabs_owner" on tabs;
create policy "tabs_owner" on tabs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sub_tabs_owner" on sub_tabs;
create policy "sub_tabs_owner" on sub_tabs for all
  using (exists (select 1 from tabs t where t.id = sub_tabs.tab_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tabs t where t.id = sub_tabs.tab_id and t.user_id = auth.uid()));

drop policy if exists "sections_owner" on sections;
create policy "sections_owner" on sections for all
  using (exists (select 1 from sub_tabs st join tabs t on t.id = st.tab_id where st.id = sections.sub_tab_id and t.user_id = auth.uid()))
  with check (exists (select 1 from sub_tabs st join tabs t on t.id = st.tab_id where st.id = sections.sub_tab_id and t.user_id = auth.uid()));

-- Owner + admin access. Coach access is added in the Garden section below,
-- once the clients/coaches tables exist (see "items_coach_access").
drop policy if exists "items_owner_or_admin" on items;
create policy "items_owner_or_admin" on items for all
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "item_relationships_owner" on item_relationships;
create policy "item_relationships_owner" on item_relationships for all
  using (exists (select 1 from items i where i.id = item_relationships.item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from items i where i.id = item_relationships.item_id and i.user_id = auth.uid()));

drop policy if exists "kpi_widgets_owner" on kpi_widgets;
create policy "kpi_widgets_owner" on kpi_widgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_views_owner" on saved_views;
create policy "saved_views_owner" on saved_views for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "templates_owner_or_public" on templates;
create policy "templates_owner_or_public" on templates for select using (auth.uid() = user_id or is_public = true);
drop policy if exists "templates_owner_write" on templates;
create policy "templates_owner_write" on templates for insert with check (auth.uid() = user_id);
drop policy if exists "templates_owner_update" on templates;
create policy "templates_owner_update" on templates for update using (auth.uid() = user_id);
drop policy if exists "templates_owner_delete" on templates;
create policy "templates_owner_delete" on templates for delete using (auth.uid() = user_id);

-- ============================================================
-- GARDEN — Coaching
-- ============================================================
create table if not exists coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text,
  email text,
  bio text,
  credentials text,
  phone text,
  photo_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  name text not null,
  description text,
  hours numeric,
  price numeric,
  duration_weeks int,
  session_count int,
  message_limit int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  coach_id uuid not null references coaches(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  status text not null default 'prospect' check (status in ('prospect','active','paused','completed','graduated','churned','archived')),
  package_id uuid references packages(id),
  intake_answers jsonb not null default '{}'::jsonb,
  goals text[],
  start_date date,
  end_date date,
  notes text,
  current_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists session_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  name text not null,
  description text,
  structure jsonb not null default '{}'::jsonb,
  category text check (category in ('career','leadership','business','accountability','mindset','faith','review','planning')),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid not null references coaches(id) on delete cascade,
  scheduled_at timestamptz,
  duration_minutes int,
  mode text default 'coaching' check (mode in ('coaching','personal_dev','mixed')),
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled','rescheduled','forfeited','no_show')),
  template_id uuid references session_templates(id),
  zoom_link text,
  zoom_meeting_id text,
  google_event_id text,
  prep_notes text,
  summary text,
  tools_used text[],
  follow_up_generated boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  type text not null check (type in ('prep','live','post','insight')),
  content text,
  tools_used text[],
  created_at timestamptz not null default now()
);

create table if not exists session_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid not null references coaches(id) on delete cascade,
  title text not null,
  description text,
  status text default 'active',
  created_at timestamptz not null default now()
);

create table if not exists session_plan_topics (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references session_plans(id) on delete cascade,
  topic text not null,
  description text,
  order_index int not null default 0,
  status text default 'pending',
  resources uuid[],
  session_id uuid references sessions(id)
);

create table if not exists coach_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null default 'google',
  calendar_id text not null,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  day_of_week int,
  start_time time,
  end_time time,
  is_recurring boolean default true,
  specific_date date,
  calendar_email text
);

create table if not exists availability_overrides (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  reason text,
  client_id uuid references clients(id)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  booked_at timestamptz not null default now(),
  status text default 'confirmed'
);

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text,
  trigger_offset int,
  require_all boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  content text not null,
  type text not null check (type in ('long_text','short_text','scale','choice')),
  order_index int not null default 0,
  required boolean default true
);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  template_url text,
  status text not null default 'pending' check (status in ('pending','signed','expired')),
  signed_at timestamptz,
  expires_at timestamptz,
  signature_data text,
  signature_coach text,
  reminder_sent boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  package_id uuid references packages(id),
  amount numeric not null,
  stripe_payment_id text,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric not null,
  description text,
  status text not null default 'pending' check (status in ('pending','paid','overdue')),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric not null,
  expires_at timestamptz,
  max_uses int,
  uses_count int not null default 0,
  is_active boolean not null default true
);

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  name text not null,
  subject text,
  body text,
  variables text[],
  trigger_type text
);

-- Async messaging (Addendum)
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_id uuid not null references coaches(id) on delete cascade,
  subject text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table coaches enable row level security;
alter table packages enable row level security;
alter table clients enable row level security;
alter table session_templates enable row level security;
alter table sessions enable row level security;
alter table session_notes enable row level security;
alter table session_plans enable row level security;
alter table session_plan_topics enable row level security;
alter table coach_calendars enable row level security;
alter table availability enable row level security;
alter table availability_overrides enable row level security;
alter table bookings enable row level security;
alter table surveys enable row level security;
alter table survey_questions enable row level security;
alter table survey_responses enable row level security;
alter table contracts enable row level security;
alter table payments enable row level security;
alter table invoices enable row level security;
alter table coupons enable row level security;
alter table email_templates enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Coach-owned tables: coach can manage their own; admins manage all
drop policy if exists "coaches_self_or_admin" on coaches;
create policy "coaches_self_or_admin" on coaches for all
  using (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "packages_coach_or_admin" on packages;
create policy "packages_coach_or_admin" on packages for all
  using (exists (select 1 from coaches c where c.id = packages.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from coaches c where c.id = packages.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Public can read active packages (for booking page)
drop policy if exists "packages_public_read_active" on packages;
create policy "packages_public_read_active" on packages for select using (is_active = true);

drop policy if exists "clients_coach_admin_or_self" on clients;
create policy "clients_coach_admin_or_self" on clients for all
  using (
    auth.uid() = user_id
    or exists (select 1 from coaches c where c.id = clients.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from coaches c where c.id = clients.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- items coach access (deferred from Roots section — needs clients/coaches to exist).
-- A coach can read/write the items of any client they own (powers "Act As Client").
drop policy if exists "items_coach_access" on items;
create policy "items_coach_access" on items for all
  using (
    exists (
      select 1 from clients c
      join coaches co on co.id = c.coach_id
      where c.user_id = items.user_id and co.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from clients c
      join coaches co on co.id = c.coach_id
      where c.user_id = items.user_id and co.user_id = auth.uid()
    )
  );

-- Generic helper pattern for the remaining coach<->client tables: visible to the owning coach, the linked client, or admin
drop policy if exists "session_templates_coach_or_admin" on session_templates;
create policy "session_templates_coach_or_admin" on session_templates for all
  using (exists (select 1 from coaches c where c.id = session_templates.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from coaches c where c.id = session_templates.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "sessions_coach_client_admin" on sessions;
create policy "sessions_coach_client_admin" on sessions for all
  using (
    exists (select 1 from coaches c where c.id = sessions.coach_id and c.user_id = auth.uid())
    or exists (select 1 from clients cl where cl.id = sessions.client_id and cl.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from coaches c where c.id = sessions.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "session_notes_coach_admin" on session_notes;
create policy "session_notes_coach_admin" on session_notes for all
  using (exists (select 1 from sessions s join coaches c on c.id = s.coach_id where s.id = session_notes.session_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from sessions s join coaches c on c.id = s.coach_id where s.id = session_notes.session_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "session_plans_coach_client_admin" on session_plans;
create policy "session_plans_coach_client_admin" on session_plans for all
  using (
    exists (select 1 from coaches c where c.id = session_plans.coach_id and c.user_id = auth.uid())
    or exists (select 1 from clients cl where cl.id = session_plans.client_id and cl.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (exists (select 1 from coaches c where c.id = session_plans.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "session_plan_topics_via_plan" on session_plan_topics;
create policy "session_plan_topics_via_plan" on session_plan_topics for all
  using (exists (select 1 from session_plans sp join coaches c on c.id = sp.coach_id where sp.id = session_plan_topics.plan_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from session_plans sp join coaches c on c.id = sp.coach_id where sp.id = session_plan_topics.plan_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "coach_calendars_self" on coach_calendars;
create policy "coach_calendars_self" on coach_calendars for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "availability_coach_or_public_read" on availability;
create policy "availability_coach_or_public_read" on availability for select using (true);
drop policy if exists "availability_coach_write" on availability;
create policy "availability_coach_write" on availability for insert with check (exists (select 1 from coaches c where c.id = availability.coach_id and c.user_id = auth.uid()));
drop policy if exists "availability_coach_update" on availability;
create policy "availability_coach_update" on availability for update using (exists (select 1 from coaches c where c.id = availability.coach_id and c.user_id = auth.uid()));
drop policy if exists "availability_coach_delete" on availability;
create policy "availability_coach_delete" on availability for delete using (exists (select 1 from coaches c where c.id = availability.coach_id and c.user_id = auth.uid()));

drop policy if exists "availability_overrides_coach" on availability_overrides;
create policy "availability_overrides_coach" on availability_overrides for all
  using (exists (select 1 from coaches c where c.id = availability_overrides.coach_id and c.user_id = auth.uid()))
  with check (exists (select 1 from coaches c where c.id = availability_overrides.coach_id and c.user_id = auth.uid()));

drop policy if exists "bookings_client_or_coach" on bookings;
create policy "bookings_client_or_coach" on bookings for all
  using (
    exists (select 1 from clients cl where cl.id = bookings.client_id and cl.user_id = auth.uid())
    or exists (select 1 from sessions s join coaches c on c.id = s.coach_id where s.id = bookings.session_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (exists (select 1 from clients cl where cl.id = bookings.client_id and cl.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "surveys_coach_or_admin" on surveys;
create policy "surveys_coach_or_admin" on surveys for all
  using (exists (select 1 from coaches c where c.id = surveys.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from coaches c where c.id = surveys.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Questions are not sensitive: any authenticated user can read them (clients
-- need them to fill surveys); only the owning coach or an admin can write.
drop policy if exists "survey_questions_read" on survey_questions;
create policy "survey_questions_read" on survey_questions for select using (auth.uid() is not null);
drop policy if exists "survey_questions_write" on survey_questions;
create policy "survey_questions_write" on survey_questions for insert
  with check (exists (select 1 from surveys s join coaches c on c.id = s.coach_id where s.id = survey_questions.survey_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "survey_questions_update" on survey_questions;
create policy "survey_questions_update" on survey_questions for update
  using (exists (select 1 from surveys s join coaches c on c.id = s.coach_id where s.id = survey_questions.survey_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "survey_questions_delete" on survey_questions;
create policy "survey_questions_delete" on survey_questions for delete
  using (exists (select 1 from surveys s join coaches c on c.id = s.coach_id where s.id = survey_questions.survey_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "survey_responses_client_or_coach" on survey_responses;
create policy "survey_responses_client_or_coach" on survey_responses for all
  using (
    exists (select 1 from clients cl where cl.id = survey_responses.client_id and cl.user_id = auth.uid())
    or exists (select 1 from surveys s join coaches c on c.id = s.coach_id where s.id = survey_responses.survey_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from clients cl where cl.id = survey_responses.client_id and cl.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "contracts_client_or_coach" on contracts;
create policy "contracts_client_or_coach" on contracts for all
  using (
    exists (select 1 from clients cl where cl.id = contracts.client_id and cl.user_id = auth.uid())
    or exists (select 1 from coaches c where c.id = contracts.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (exists (select 1 from coaches c where c.id = contracts.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "payments_client_or_coach" on payments;
create policy "payments_client_or_coach" on payments for all
  using (
    exists (select 1 from clients cl where cl.id = payments.client_id and cl.user_id = auth.uid())
    or exists (select 1 from clients cl join coaches c on c.id = cl.coach_id where cl.id = payments.client_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "invoices_client_or_coach" on invoices;
create policy "invoices_client_or_coach" on invoices for all
  using (
    exists (select 1 from clients cl where cl.id = invoices.client_id and cl.user_id = auth.uid())
    or exists (select 1 from clients cl join coaches c on c.id = cl.coach_id where cl.id = invoices.client_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (exists (select 1 from clients cl join coaches c on c.id = cl.coach_id where cl.id = invoices.client_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "coupons_coach_or_admin" on coupons;
create policy "coupons_coach_or_admin" on coupons for all
  using (exists (select 1 from coaches c where c.id = coupons.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from coaches c where c.id = coupons.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "email_templates_coach_or_admin" on email_templates;
create policy "email_templates_coach_or_admin" on email_templates for all
  using (exists (select 1 from coaches c where c.id = email_templates.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from coaches c where c.id = email_templates.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "conversations_client_or_coach" on conversations;
create policy "conversations_client_or_coach" on conversations for all
  using (
    exists (select 1 from clients cl where cl.id = conversations.client_id and cl.user_id = auth.uid())
    or exists (select 1 from coaches c where c.id = conversations.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from clients cl where cl.id = conversations.client_id and cl.user_id = auth.uid())
    or exists (select 1 from coaches c where c.id = conversations.coach_id and c.user_id = auth.uid())
  );

drop policy if exists "messages_via_conversation" on messages;
create policy "messages_via_conversation" on messages for all
  using (
    exists (
      select 1 from conversations conv
      left join clients cl on cl.id = conv.client_id
      left join coaches c on c.id = conv.coach_id
      where conv.id = messages.conversation_id
        and (cl.user_id = auth.uid() or c.user_id = auth.uid())
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (sender_id = auth.uid());

-- ============================================================
-- SHARED (Coach <-> Client)
-- ============================================================
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  title text not null,
  type text check (type in ('article','book','framework','course','exercise')),
  content text,
  url text,
  is_public boolean default false,
  category text,
  related_principles text[],
  created_at timestamptz not null default now()
);

create table if not exists shared_items (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  type text not null check (type in ('resource','action_item','item_visibility')),
  reference_id uuid,
  message text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists client_activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null check (type in ('session','comment','resource_shared','goal_completed','action_finished','survey_submitted','payment','habit_missed')),
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);

alter table resources enable row level security;
alter table shared_items enable row level security;
alter table client_activity enable row level security;

drop policy if exists "resources_coach_write_public_read" on resources;
create policy "resources_coach_write_public_read" on resources for select using (is_public = true or exists (select 1 from coaches c where c.id = resources.coach_id and c.user_id = auth.uid()) or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "resources_coach_insert" on resources;
create policy "resources_coach_insert" on resources for insert with check (exists (select 1 from coaches c where c.id = resources.coach_id and c.user_id = auth.uid()));
drop policy if exists "resources_coach_update" on resources;
create policy "resources_coach_update" on resources for update using (exists (select 1 from coaches c where c.id = resources.coach_id and c.user_id = auth.uid()));
drop policy if exists "resources_coach_delete" on resources;
create policy "resources_coach_delete" on resources for delete using (exists (select 1 from coaches c where c.id = resources.coach_id and c.user_id = auth.uid()));

drop policy if exists "shared_items_participant" on shared_items;
create policy "shared_items_participant" on shared_items for all
  using (auth.uid() = from_user_id or auth.uid() = to_user_id)
  with check (auth.uid() = from_user_id);

drop policy if exists "client_activity_client_or_coach" on client_activity;
create policy "client_activity_client_or_coach" on client_activity for all
  using (
    exists (select 1 from clients cl where cl.id = client_activity.client_id and cl.user_id = auth.uid())
    or exists (select 1 from clients cl join coaches c on c.id = cl.coach_id where cl.id = client_activity.client_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (exists (select 1 from clients cl join coaches c on c.id = cl.coach_id where cl.id = client_activity.client_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================
-- CONTENT MANAGEMENT
-- ============================================================
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  stage text not null default 'idea' check (stage in ('idea','thought','draft','article','framework','course','book','workshop')),
  tags text[],
  platform_versions jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  review_date date,
  review_interval text check (review_interval in ('6mo','12mo','24mo','none')),
  related_resources uuid[],
  related_principles text[],
  related_businesses text[],
  assignments_count int not null default 0,
  references_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_calendar (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references content_items(id) on delete cascade,
  platform text check (platform in ('blog','linkedin','facebook','instagram','newsletter')),
  scheduled_date date,
  status text default 'scheduled' check (status in ('scheduled','published','cancelled'))
);

create table if not exists content_published (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references content_items(id) on delete cascade,
  platform text,
  published_at timestamptz not null default now(),
  url text
);

create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  platform text not null,
  version_text text,
  status text default 'draft' check (status in ('draft','scheduled','published')),
  publish_date date
);

create table if not exists content_assignments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  target_type text not null check (target_type in ('client','learning_path','resource_library')),
  target_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists content_relationships (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  related_type text not null check (related_type in ('principle','book','framework','business')),
  related_id uuid
);

alter table content_items enable row level security;
alter table content_calendar enable row level security;
alter table content_published enable row level security;
alter table content_versions enable row level security;
alter table content_assignments enable row level security;
alter table content_relationships enable row level security;

drop policy if exists "content_items_admin_write_public_read" on content_items;
create policy "content_items_admin_write_public_read" on content_items for select
  using (is_public = true or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "content_items_admin_insert" on content_items;
create policy "content_items_admin_insert" on content_items for insert with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "content_items_admin_update" on content_items;
create policy "content_items_admin_update" on content_items for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "content_items_admin_delete" on content_items;
create policy "content_items_admin_delete" on content_items for delete using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "content_calendar_admin" on content_calendar;
create policy "content_calendar_admin" on content_calendar for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "content_published_public_read" on content_published;
create policy "content_published_public_read" on content_published for select using (true);
drop policy if exists "content_published_admin_write" on content_published;
create policy "content_published_admin_write" on content_published for insert with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "content_versions_admin" on content_versions;
create policy "content_versions_admin" on content_versions for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "content_assignments_admin" on content_assignments;
create policy "content_assignments_admin" on content_assignments for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "content_relationships_admin" on content_relationships;
create policy "content_relationships_admin" on content_relationships for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('session_reminder','overdue_item','resource_shared','action_item','contract_expiring','survey_due','habit_missed','content_review_due','new_message')),
  title text not null,
  body text,
  read boolean not null default false,
  channel text not null default 'in_app' check (channel in ('in_app','push','email','sms')),
  reference_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table notifications enable row level security;
drop policy if exists "notifications_owner" on notifications;
create policy "notifications_owner" on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- SYSTEM
-- ============================================================
create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
alter table feature_flags enable row level security;

drop policy if exists "app_settings_public_read" on app_settings;
create policy "app_settings_public_read" on app_settings for select using (true);
drop policy if exists "app_settings_admin_write" on app_settings;
create policy "app_settings_admin_write" on app_settings for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "feature_flags_public_read" on feature_flags;
create policy "feature_flags_public_read" on feature_flags for select using (true);
drop policy if exists "feature_flags_admin_write" on feature_flags;
create policy "feature_flags_admin_write" on feature_flags for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Seed initial feature flags
insert into feature_flags (key, enabled, description) values
  ('roots_enabled', true, 'Roots app available to users'),
  ('garden_enabled', true, 'Garden coaching admin available'),
  ('content_enabled', true, 'Content management available'),
  ('store_enabled', false, 'Public store — coming soon placeholder'),
  ('builder_mode_enabled', true, 'Builder mode toggle available in Roots'),
  ('stripe_payments_enabled', false, 'Stripe checkout — enable once webhook configured'),
  ('zoom_integration_enabled', false, 'Auto-generate Zoom links for sessions'),
  ('twilio_sms_enabled', false, 'SMS reminders — enable once phone number provisioned'),
  ('google_calendar_sync_enabled', false, 'Sync sessions to Google Calendar')
on conflict (key) do nothing;

insert into app_settings (key, value, description) values
  ('business_name', 'Harvest Your Passion LLC', 'Display name across the platform'),
  ('tagline', 'Harvest Your Passion, Cultivate Success!', 'Brand tagline'),
  ('default_reminder_offsets', '48,24,1', 'Hours before session to send reminders'),
  ('platform_version', '2.0', 'Current spec version')
on conflict (key) do nothing;

-- ============================================================
-- DONE
-- ============================================================
