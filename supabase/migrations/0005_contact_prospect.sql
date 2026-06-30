-- Public contact form → prospect (LEO-006 addendum C).
-- Anonymous visitors may INSERT a clients row ONLY as a prospect, and may not
-- read anything back. Coaches/admins still manage via existing policies.

-- The message + interest from the form ride along in intake_answers JSONB.
drop policy if exists "clients_anon_prospect_insert" on clients;
create policy "clients_anon_prospect_insert" on clients for insert
  to anon, authenticated
  with check (status = 'prospect');

-- Make sure the coach default is set so prospects attach to Leo's coach.
-- (coach_id is supplied by the form; this is a safety default if null.)
