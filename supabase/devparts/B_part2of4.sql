-- B part 2 of 4 - run in order, in the DEV project

grant execute on function next_po_number(text) to authenticated;

-- --- self-healing campaign status -----------------------------------------
create or replace function sync_campaign_statuses()
returns void
language sql security definer set search_path = public
as $$
  update campaigns set status = 'live'
   where status = 'booked' and start_date is not null and start_date <= current_date
     and (end_date is null or end_date >= current_date);

update campaigns set status = 'done'
   where status in ('booked', 'live', 'risk')
     and end_date is not null and end_date < current_date;

$$;

grant execute on function sync_campaign_statuses() to authenticated;

-- --- 1.1 role guard: users can't change their own role/email/sales ---------
create or replace function guard_profile_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare actor_role text;

begin
  select role into actor_role from profiles where id = auth.uid();

if auth.uid() is null then return new; end if;

if coalesce(actor_role, '') = 'admin' then return new; end if;

if new.role     is distinct from old.role     then raise exception 'Only an administrator can change a user role'; end if;

if new.is_sales is distinct from old.is_sales  then raise exception 'Only an administrator can change sales status'; end if;

if new.email    is distinct from old.email     then raise exception 'Only an administrator can change an email address'; end if;

if new.id       is distinct from old.id        then raise exception 'A profile id cannot be changed'; end if;

return new;

end;

$$;

drop trigger if exists guard_profile_fields_trg on profiles;

create trigger guard_profile_fields_trg
  before update on profiles
  for each row execute function guard_profile_fields();

-- --- policies (final form) -------------------------------------------------
-- profiles: any signed-in user may read; a user may update only their own row,
-- with protected fields enforced by the guard trigger above.
drop policy if exists "authenticated read profiles" on profiles;

create policy "authenticated read profiles" on profiles for select using (auth.role() = 'authenticated');

drop policy if exists "self update profile" on profiles;

create policy "self update profile" on profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- clients / campaigns / lines / leads / creative / contacts: owner-or-full-staff
drop policy if exists "clients visible to owner or full staff" on clients;
