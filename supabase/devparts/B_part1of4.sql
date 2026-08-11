-- B part 1 of 4 - run in order, in the DEV project

-- ADEX Mission Control — baseline 0002: functions, triggers, RLS policies
--
-- The security-definer functions, the sign-up handling, the role guard from
-- work package 1.1, and every RLS policy in its final production form.
-- Run after 0001. Safe to re-run.

-- --- sign-up: only staff-list emails get an account ------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  match staff_roles%rowtype;

begin
  select * into match from staff_roles where lower(email) = lower(new.email);

if match.email is null then
    raise exception 'Email % is not on the ADEX staff list', new.email
      using hint = 'Ask an admin to add you to staff_roles first.';

end if;

insert into profiles (id, email, full_name, role, is_sales)
  values (new.id, new.email, match.full_name, match.role, match.is_sales);

return new;

end;

$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_staff_email(p_email text)
returns boolean
language sql security definer set search_path = public stable
as $$ select exists (select 1 from staff_roles where lower(email) = lower(p_email)); $$;

grant execute on function is_staff_email(text) to anon, authenticated;

-- --- restricted-role helpers ----------------------------------------------
create or replace function is_restricted()
returns boolean
language sql security definer set search_path = public stable
as $$ select coalesce((select role = 'restricted' from profiles where id = auth.uid()), false); $$;

create or replace function can_see_client(p_client uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select not is_restricted()
      or exists (select 1 from clients c where c.id = p_client and c.owner_id = auth.uid());

$$;

grant execute on function is_restricted() to authenticated;

grant execute on function can_see_client(uuid) to authenticated;

-- --- PO numbering ----------------------------------------------------------
create or replace function next_po_number(p_prefix text)
returns text
language plpgsql security definer set search_path = public
as $$
declare n integer;

begin
  insert into po_counters (prefix, last_number) values (upper(p_prefix), 1)
  on conflict (prefix) do update set last_number = po_counters.last_number + 1
  returning last_number into n;

return upper(p_prefix) || lpad(n::text, 4, '0');

end;

$$;
