-- Schedule session reminders every 15 minutes via pg_cron + pg_net.
-- The cron auth key is read from Supabase Vault by name (never stored here),
-- and passed to the send-reminders function as x-cron-key.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace any existing job of this name.
select cron.unschedule('harvest-session-reminders')
where exists (select 1 from cron.job where jobname = 'harvest-session-reminders');

select cron.schedule(
  'harvest-session-reminders',
  '*/15 * * * *',
  $CRON$
  select net.http_post(
    url := 'https://rjjhuugtwwimsijnmvwy.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'harvest_cron_key')
    ),
    body := '{}'::jsonb
  );
  $CRON$
);
