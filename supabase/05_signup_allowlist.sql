-- ADEX Mission Control — self sign-up, restricted to the staff list
--
-- Lets the team create their own passwords at /signup instead of waiting for
-- invite emails, while making sure only people on staff_roles can get in.
-- Enforcement is in the database, so it holds even though the sign-up page
-- is on a public URL.

-- 1. Reject any sign-up whose email is not on the staff list. Raising here
--    aborts the auth.users insert, so no account is created.
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

-- 2. Let the sign-up page check an address before submitting, so someone
--    mistyping their email gets a clear message instead of a database error.
--    Security definer + a boolean return means the staff list itself stays private.
create or replace function is_staff_email(p_email text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from staff_roles where lower(email) = lower(p_email));
$$;

grant execute on function is_staff_email(text) to anon, authenticated;
