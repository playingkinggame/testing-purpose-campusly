-- =====================================================================
-- Campusly phase 4: email + password sign-in helpers
-- Run once in the Supabase SQL editor (safe to run again).
-- =====================================================================

-- 1. Every account must have a profile row. Create any that are missing
--    (for example accounts made before the sign-up trigger existed).
insert into public.profiles (id)
select u.id
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 2. Make sure the trigger that creates a profile for every NEW account is in place.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

create or replace trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Safety net used by the app right after login: creates the caller's own profile if it is missing.
create or replace function public.ensure_my_profile() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
end $$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
