-- Web Push subscriptions (PWA push notifications).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_own" on push_subscriptions;
create policy "push_own" on push_subscriptions for all
  using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (user_id = auth.uid());

-- Feature flag for push.
insert into feature_flags (key, enabled, description)
values ('push_enabled', false, 'PWA web push notifications')
on conflict (key) do nothing;
