-- Fix: infinite recursion in RLS (Postgres 42P17).
-- The profiles policies referenced the profiles table inside their own USING
-- clause; evaluating that re-triggered the same policy endlessly, and since
-- nearly every other table's admin check also subqueries profiles, the whole
-- API returned 500s.
--
-- Fix: a SECURITY DEFINER helper that reads the role bypassing RLS, breaking
-- the loop. profiles policies use it directly; other tables' inline
-- profiles-admin subqueries then resolve fine (they only need the caller's own
-- row, which the self-access branch already permits).

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Recreate profiles policies without self-recursion.
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id or public.is_admin());

-- Allow the auth trigger / users to insert their own profile row.
drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert
  with check (auth.uid() = id);
