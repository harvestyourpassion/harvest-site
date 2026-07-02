-- #16: let a client read the topics of their own session plan (was coach/admin
-- only). Read-only — writes stay coach/admin via the existing policy.
drop policy if exists "session_plan_topics_client_read" on session_plan_topics;
create policy "session_plan_topics_client_read" on session_plan_topics for select
  using (exists (
    select 1 from session_plans sp join clients cl on cl.id = sp.client_id
    where sp.id = session_plan_topics.plan_id and cl.user_id = auth.uid()
  ));
