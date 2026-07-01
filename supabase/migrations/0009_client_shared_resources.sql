-- Let a client read a resource that a coach shared with them (via shared_items).
-- The base resources policy only allowed public/coach/admin reads, so shared
-- non-public resources were invisible to the client they were shared with.

drop policy if exists "resources_shared_client_read" on resources;
create policy "resources_shared_client_read" on resources for select
  using (
    exists (
      select 1 from shared_items si
      where si.reference_id = resources.id
        and si.type = 'resource'
        and si.to_user_id = auth.uid()
    )
  );
