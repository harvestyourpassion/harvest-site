-- Track a client's package progress (sessions used/remaining) for manual
-- package assignment + progress editing (audit items #19/#20), and a flag to
-- mark test purchases (#8) for easy cleanup.
alter table clients add column if not exists sessions_total int;
alter table clients add column if not exists sessions_used int not null default 0;
alter table clients add column if not exists package_started_at timestamptz;
alter table clients add column if not exists package_expires_at timestamptz;

alter table payments add column if not exists is_test boolean not null default false;
