-- ADEX Mission Control — tasks, PO/invoice numbering, creative brief detail,
-- and restricted access for account managers who should only see their own book.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------- roles ----
-- 'restricted' sees only their own clients and nothing commercial.
alter table staff_roles drop constraint if exists staff_roles_role_check;
alter table staff_roles add constraint staff_roles_role_check
  check (role in ('admin', 'standard', 'restricted'));

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'standard', 'restricted'));

insert into staff_roles (email, full_name, role, is_sales) values
  ('darren.waight@advertisingexcellence.co.uk', 'Darren Waight', 'restricted', true)
on conflict (email) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  is_sales = excluded.is_sales;

update profiles p set full_name = s.full_name, role = s.role, is_sales = s.is_sales
from staff_roles s where lower(s.email) = lower(p.email);

-- ------------------------------------------------- purchase order numbers ---
-- Supplier POs continue Connor's existing numbering. The counter below is the
-- last number already used outside this system; set it once the historic
-- orders are imported, and every new booking line takes the next number.
create table if not exists po_counters (
  prefix text primary key,
  last_number integer not null default 0
);

alter table campaign_lines add column if not exists supplier_po text;
alter table campaigns     add column if not exists client_po text;

create unique index if not exists campaign_lines_supplier_po_key
  on campaign_lines (supplier_po) where supplier_po is not null;

-- Issues the next PO number for a prefix, e.g. next_po_number('RAN') -> RAN0101.
create or replace function next_po_number(p_prefix text)
returns text
language plpgsql
security definer set search_path = public
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

-- ----------------------------------------------------- client invoicing ----
create table if not exists client_invoices (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  invoice_no text unique,
  invoice_date date not null default current_date,
  amount_ex_vat numeric(12,2) not null default 0,
  vat numeric(12,2) generated always as (round(amount_ex_vat * 0.20, 2)) stored,
  status text not null default 'Draft' check (status in ('Draft','Sent','Paid')),
  xero_id text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------ creative detail ----
alter table creative_items add column if not exists design_source text
  default 'inhouse' check (design_source in ('inhouse', 'client'));
alter table creative_items add column if not exists campaign_id uuid
  references campaigns(id) on delete cascade;

-- ------------------------------------------------------------- tasks -------
-- Follow-ups and reminders. A task hangs off whichever record prompted it.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  kind text not null default 'follow-up'
    check (kind in ('follow-up', 'creative', 'copy-deadline', 'admin')),
  assignee_id uuid references profiles(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete cascade,
  client_id   uuid references clients(id)   on delete cascade,
  lead_id     uuid references leads(id)     on delete cascade,
  creative_id uuid references creative_items(id) on delete cascade,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_due_idx on tasks (done, due_date);
create index if not exists tasks_assignee_idx on tasks (assignee_id);

-- ------------------------------------------------------------- RLS ---------
alter table po_counters      enable row level security;
alter table client_invoices  enable row level security;
alter table tasks            enable row level security;

-- True when the signed-in user is limited to their own accounts.
create or replace function is_restricted()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select role = 'restricted' from profiles where id = auth.uid()), false);
$$;

-- True when the client belongs to the signed-in user (or they aren't restricted).
create or replace function can_see_client(p_client uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select not is_restricted()
      or exists (select 1 from clients c where c.id = p_client and c.owner_id = auth.uid());
$$;

grant execute on function is_restricted() to authenticated;
grant execute on function can_see_client(uuid) to authenticated;

-- Replace the blanket policies with ones that respect the restriction.
drop policy if exists "authenticated all clients" on clients;
create policy "clients visible to owner or full staff" on clients
  for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

drop policy if exists "authenticated all campaigns" on campaigns;
create policy "campaigns visible to owner or full staff" on campaigns
  for all to authenticated
  using (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id))
  with check (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id));

drop policy if exists "authenticated all campaign_lines" on campaign_lines;
create policy "campaign lines follow their campaign" on campaign_lines
  for all to authenticated
  using (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))))
  with check (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))));

drop policy if exists "authenticated all leads" on leads;
create policy "leads visible to owner or full staff" on leads
  for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

drop policy if exists "authenticated all creative_items" on creative_items;
create policy "creative visible to owner or full staff" on creative_items
  for all to authenticated
  using (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id))
  with check (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id));

-- Commercial tables stay closed to restricted users entirely.
drop policy if exists "authenticated all supplier_invoices" on supplier_invoices;
create policy "supplier invoices for full staff" on supplier_invoices
  for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

create policy "client invoices for full staff" on client_invoices
  for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

create policy "po counters for full staff" on po_counters
  for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

create policy "tasks visible to full staff or own" on tasks
  for all to authenticated
  using (not is_restricted() or assignee_id = auth.uid())
  with check (not is_restricted() or assignee_id = auth.uid());

-- ---------------------------------------------- automatic status moves -----
-- Booked campaigns go Live on their start date; Live ones Complete the day
-- after they finish. Called whenever campaigns are read, so it self-heals
-- without needing a scheduler.
create or replace function sync_campaign_statuses()
returns void
language sql
security definer set search_path = public
as $$
  update campaigns set status = 'live'
   where status = 'booked' and start_date is not null and start_date <= current_date
     and (end_date is null or end_date >= current_date);

  update campaigns set status = 'done'
   where status in ('booked', 'live', 'risk')
     and end_date is not null and end_date < current_date;
$$;

grant execute on function sync_campaign_statuses() to authenticated;

select 'migration complete' as result;
