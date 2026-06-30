-- Leo's admin accounts. He uses several emails; all are admin.
-- The trigger grants admin automatically when any of these first logs in.

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url, role, mode)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    case when new.email in (
      'harvestyourpassionllc@gmail.com',
      'leandrocastillo@harvestyourpassion.com',
      'leandro.castillo.1994@gmail.com',
      'tacoslosprimos99@gmail.com'
    ) then 'admin' else 'user' end,
    'simple'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Promote Leo's existing accounts to admin now.
update public.profiles set role = 'admin', updated_at = now()
where email in (
  'harvestyourpassionllc@gmail.com',
  'leandrocastillo@harvestyourpassion.com',
  'leandro.castillo.1994@gmail.com',
  'tacoslosprimos99@gmail.com'
);
