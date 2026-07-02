-- Support date-based survey scheduling (#23) alongside int trigger_offset.
alter table surveys add column if not exists trigger_date date;
alter table surveys add column if not exists notify_channel text default 'in_app';
