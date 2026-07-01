-- Allow a client to sign their OWN contract (e-signature). The original
-- with_check only permitted coach/admin writes, which blocked the client from
-- updating the row to signed. Broaden write to include the owning client.

drop policy if exists "contracts_client_or_coach" on contracts;
create policy "contracts_client_or_coach" on contracts for all
  using (
    exists (select 1 from clients cl where cl.id = contracts.client_id and cl.user_id = auth.uid())
    or exists (select 1 from coaches c where c.id = contracts.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from clients cl where cl.id = contracts.client_id and cl.user_id = auth.uid())
    or exists (select 1 from coaches c where c.id = contracts.coach_id and c.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
