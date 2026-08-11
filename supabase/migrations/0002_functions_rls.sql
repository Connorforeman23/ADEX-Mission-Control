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
create policy "clients visible to owner or full staff" on clients for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

drop policy if exists "campaigns visible to owner or full staff" on campaigns;
create policy "campaigns visible to owner or full staff" on campaigns for all to authenticated
  using (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id))
  with check (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id));

drop policy if exists "campaign lines follow their campaign" on campaign_lines;
create policy "campaign lines follow their campaign" on campaign_lines for all to authenticated
  using (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))))
  with check (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))));

drop policy if exists "leads visible to owner or full staff" on leads;
create policy "leads visible to owner or full staff" on leads for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

drop policy if exists "creative visible to owner or full staff" on creative_items;
create policy "creative visible to owner or full staff" on creative_items for all to authenticated
  using (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id))
  with check (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id));

drop policy if exists "contacts visible to owner or full staff" on contacts;
create policy "contacts visible to owner or full staff" on contacts for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

-- commercial tables: closed to restricted users entirely
drop policy if exists "supplier invoices for full staff" on supplier_invoices;
create policy "supplier invoices for full staff" on supplier_invoices for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

drop policy if exists "client invoices for full staff" on client_invoices;
create policy "client invoices for full staff" on client_invoices for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

drop policy if exists "po counters for full staff" on po_counters;
create policy "po counters for full staff" on po_counters for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

drop policy if exists "tasks visible to full staff or own" on tasks;
create policy "tasks visible to full staff or own" on tasks for all to authenticated
  using (not is_restricted() or assignee_id = auth.uid())
  with check (not is_restricted() or assignee_id = auth.uid());

-- staff_roles stays RLS-on with no policy: reached only via the definer
-- functions above, so all direct client access is denied.

select '0002_functions_rls complete' as result;
