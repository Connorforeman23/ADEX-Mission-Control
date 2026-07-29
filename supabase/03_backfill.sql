-- ADEX Mission Control — backfill profiles from staff_roles
--
-- The handle_new_user() trigger only fires when an auth user is created, so
-- anyone invited BEFORE 02_staff.sql was run has a profile with fallback
-- values. This syncs them, and creates profile rows for any auth user that
-- somehow has none. Safe to re-run at any time.

-- 0. Patch the signup trigger to match emails case-insensitively (the original
--    version compared exactly, which misses addresses like Jon.Murphy@...).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  match staff_roles%rowtype;
begin
  select * into match from staff_roles where lower(email) = lower(new.email);
  insert into profiles (id, email, full_name, role, is_sales)
  values (
    new.id,
    new.email,
    coalesce(match.full_name, split_part(new.email, '@', 1)),
    coalesce(match.role, 'standard'),
    coalesce(match.is_sales, false)
  );
  return new;
end;
$$;

-- 1. Create missing profile rows for existing auth users.
insert into profiles (id, email, full_name, role, is_sales)
select
  u.id,
  u.email,
  coalesce(s.full_name, split_part(u.email, '@', 1)),
  coalesce(s.role, 'standard'),
  coalesce(s.is_sales, false)
from auth.users u
left join staff_roles s on lower(s.email) = lower(u.email)
where not exists (select 1 from profiles p where p.id = u.id);

-- 2. Re-sync existing profiles with the staff directory.
update profiles p
set full_name = s.full_name,
    role = s.role,
    is_sales = s.is_sales
from staff_roles s
where lower(s.email) = lower(p.email);

-- 3. Show the result so you can eyeball it in the SQL editor.
select email, full_name, role, is_sales from profiles order by full_name;
