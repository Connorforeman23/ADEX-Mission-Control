-- Work package 1.1 - stop users promoting themselves
--
-- Today, "self update profile" lets a signed-in user update their own profiles
-- row with no restriction on which columns. That includes role, so any user can
-- make themselves an admin from the browser console. Every access restriction
-- in the app rests on that column.
--
-- This replaces the policy and adds a trigger. Belt and braces on purpose: the
-- policy governs who may update, the trigger governs what they may change, so a
-- future policy edit cannot quietly reopen the hole.
--
-- No data is changed. Safe to re-run. Rollback is at the bottom.

-- 1. A user may still update their own row...
drop policy if exists "self update profile" on profiles;
create policy "self update profile" on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. ...but the protected columns can only be changed by an admin.
create or replace function guard_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor_role text;
begin
  select role into actor_role from profiles where id = auth.uid();

  -- Changes made by the database itself (triggers, migrations, service role)
  -- have no auth.uid() and are left alone.
  if auth.uid() is null then
    return new;
  end if;

  if coalesce(actor_role, '') = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an administrator can change a user role';
  end if;
  if new.is_sales is distinct from old.is_sales then
    raise exception 'Only an administrator can change sales status';
  end if;
  if new.email is distinct from old.email then
    raise exception 'Only an administrator can change an email address';
  end if;
  if new.id is distinct from old.id then
    raise exception 'A profile id cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_fields_trg on profiles;
create trigger guard_profile_fields_trg
  before update on profiles
  for each row execute function guard_profile_fields();

-- 3. Proof it is on.
select
  (select count(*) from pg_policies
    where tablename = 'profiles' and policyname = 'self update profile') as policy_present,
  (select count(*) from pg_trigger
    where tgname = 'guard_profile_fields_trg') as trigger_present;


-- ---------------------------------------------------------------- rollback --
-- Only if this breaks something. Reopens the vulnerability.
--
-- drop trigger if exists guard_profile_fields_trg on profiles;
-- drop function if exists guard_profile_fields();
-- drop policy if exists "self update profile" on profiles;
-- create policy "self update profile" on profiles
--   for update using (auth.uid() = id);
