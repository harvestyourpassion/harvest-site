-- Google Calendar sync: store the coach's OAuth refresh token server-side.
-- RLS is enabled with NO policies, so only the service role (edge functions)
-- can read/write it — the refresh token is never exposed to the browser.

create table if not exists calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  email text,
  calendar_id text not null default 'primary',
  refresh_token text,
  access_token text,
  token_expiry timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id)
);

alter table calendar_tokens enable row level security;
-- No policies on purpose: locked to the service role.
