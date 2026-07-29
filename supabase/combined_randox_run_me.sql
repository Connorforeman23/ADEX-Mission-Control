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


-- ============ PART 2: RANDOX IMPORT ============

-- ADEX Mission Control — Randox historic import
-- Built from supplier POs RAN0091–RAN0101 and client invoice run 18754–18792.
-- ⚠ Run ONLY once Connor has approved the reconciliation.

-- ------------------------------------------------ commission per line ------
-- The Randox book proved 15% isn't universal: Irish Times is 10% and
-- production lines carry no commission. Net becomes gross less the line's
-- own rate.
alter table campaign_lines add column if not exists commission_pct numeric(5,2) not null default 15;
update campaign_lines set commission_pct = 0 where channel = 'Creative';
alter table campaign_lines drop column if exists supplier_net;
alter table campaign_lines add column supplier_net numeric(12,2)
  generated always as (round(supplier_gross * (1 - commission_pct / 100.0), 2)) stored;

-- --------------------------------------------------------- the client ------
insert into clients (name, sector, owner_id, status, client_since)
select 'Randox', 'Healthcare / diagnostics',
       (select id from profiles where lower(email) = 'connor.foreman@advertisingexcellence.co.uk'),
       'live', '2021'
on conflict (name) do nothing;

-- ------------------------------------------------------------ campaigns ----
-- Owner: Connor. Charges follow the invoices: media billed at supplier gross
-- (commission is the margin) except FTWM which is marked up to £3,500/page.
-- Production always at cost, no commission.
with me as (
  select (select id from profiles where lower(email) = 'connor.foreman@advertisingexcellence.co.uk') as owner_id,
         (select id from clients where name = 'Randox') as client_id
)
insert into campaigns (ref, name, client_id, status, owner_id, region, start_date, end_date, fee, client_po, note)
select * from (
  select 'AE-2601', 'Kingston OOH — Summer',        client_id, 'live',   owner_id, 'London',   date '2026-07-06', date '2026-08-23', 0, '232896', 'RAN0091 + RAN0092. Invoiced on 18790.' from me
  union all
  select 'AE-2602', 'FTWM Full Pages — Jul/Aug',    client_id, 'live',   owner_id, 'National', date '2026-07-04', date '2026-08-29', 0, '232683', 'RAN0093 — 9 Saturday insertions. July invoiced on 18788; August to follow (Lynsey adds to monthly invoices).' from me
  union all
  select 'AE-2603', 'M4 Tower — 6 month package',   client_id, 'booked', owner_id, 'London',   date '2026-09-07', date '2027-04-04', 0, null,     'RAN0094 bursts + RAN0097 extra creative. Client rate £6,000 per month, confirmed 29 Jul.' from me
  union all
  select 'AE-2604', 'Daily Telegraph — 01 Jul',     client_id, 'done',   owner_id, 'National', date '2026-07-01', date '2026-07-01', 0, '233004', 'RAN0095. Invoiced on 18789. (Supplier PO shows 01.07.25 — a typo for 2026.)' from me
  union all
  select 'AE-2605', 'Irish Times — July',           client_id, 'done',   owner_id, 'National', date '2026-07-01', date '2026-07-16', 0, '232931', 'RAN0096 + RAN0098. 10% commission, EUR £-equivalents. First insertion invoiced on 18781.' from me
  union all
  select 'AE-2606', 'Telegraph & Mail — w/c 06 Jul',client_id, 'done',   owner_id, 'National', date '2026-07-07', date '2026-07-16', 0, null,     'RAN0099. Awaiting invoice run.' from me
  union all
  select 'AE-2607', 'Glasgow OOH — Jul/Aug',        client_id, 'live',   owner_id, 'Scotland', date '2026-07-20', date '2026-08-02', 0, null,     'RAN0100 + RAN0101. Awaiting invoice run.' from me
) v
on conflict (ref) do nothing;

-- -------------------------------------------------------- booking lines ----
-- Several lines legitimately share one supplier PO (multi-line orders), so the
-- one-PO-per-line uniqueness from migration 07 comes off.
drop index if exists campaign_lines_supplier_po_key;
with c as (select ref, id from campaigns where ref between 'AE-2601' and 'AE-2607')
insert into campaign_lines
  (campaign_id, supplier_po, channel, vendor, detail, start_date, end_date, selected_dates,
   copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  -- AE-2601 Kingston (RAN0091 Global, RAN0092 JCDecaux)
  select (select id from c where ref='AE-2601'), 'RAN0091', 'OOH',   'Global',   'x1 48 Sheet — Kingston',            date '2026-07-13', date '2026-08-23', null, 'New Copy', 1200.00, 15, 1200.00
  union all select (select id from c where ref='AE-2601'), 'RAN0091', 'Creative', 'Global', 'Production on x1 48 Sheet',       date '2026-07-13', date '2026-07-13', null, 'New Copy', 258.00, 0, 258.00
  union all select (select id from c where ref='AE-2601'), 'RAN0092', 'OOH',   'JCD',      'x1 D6 Brentall Shopping Centre',    date '2026-07-06', date '2026-08-16', null, 'New Copy', 2100.00, 15, 2100.00

  -- AE-2602 FTWM (RAN0093 FT) — client rate £3,500/page vs supplier £3,276
  union all select (select id from c where ref='AE-2602'), 'RAN0093', 'Print', 'FT', 'FTWM Full Page RH ROM ×4 (July)',   date '2026-07-04', date '2026-07-25', 'Saturdays 04, 11, 18, 25 Jul', 'New Copy', 13104.00, 15, 14000.00
  union all select (select id from c where ref='AE-2602'), 'RAN0093','Print', 'FT', 'FTWM Full Page RH ROM ×5 (August)', date '2026-08-01', date '2026-08-29', 'Saturdays 01, 08, 15, 22, 29 Aug', 'Repeat Copy', 16380.00, 15, 17500.00

  -- AE-2603 M4 Tower (RAN0094 JCDecaux bursts + RAN0097 creative) — client charge = gross until rate confirmed
  union all select (select id from c where ref='AE-2603'), 'RAN0094',  'OOH', 'JCD', 'M4 Tower Outbound — burst 1', date '2026-09-07', date '2026-10-04', null, 'New Copy', 4600.00, 15, 6000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 2', date '2026-10-19', date '2026-11-15', null, 'Repeat Copy', 5000.00, 15, 6000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 3', date '2026-11-30', date '2026-12-27', null, 'Repeat Copy', 5000.00, 15, 6000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 4', date '2026-12-28', date '2027-01-24', null, 'Repeat Copy', 5000.00, 15, 6000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 5', date '2027-01-25', date '2027-02-21', null, 'Repeat Copy', 5000.00, 15, 6000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 6', date '2027-02-22', date '2027-04-04', null, 'Repeat Copy', 5000.00, 15, 6000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'Creative', 'JCD', 'Production ×2',           date '2026-09-07', date '2026-09-07', null, 'New Copy', 800.00, 0, 800.00
  union all select (select id from c where ref='AE-2603'), 'RAN0097',  'Creative', 'JCD', 'Extra creative — production', date '2026-07-13', date '2026-07-13', null, 'New Copy', 400.00, 0, 400.00

  -- AE-2604 Daily Telegraph (RAN0095 Mail Metro Media)
  union all select (select id from c where ref='AE-2604'), 'RAN0095', 'Print', 'MMM', 'Daily Telegraph Full Page RH Front Half', date '2026-07-01', date '2026-07-01', 'Wednesday 01 Jul', 'New Copy', 12000.00, 15, 12000.00

  -- AE-2605 Irish Times (RAN0096 + RAN0098) — 10% commission, GBP equivalents of €8,500 (£7,327.38 as invoiced)
  union all select (select id from c where ref='AE-2605'), 'RAN0096', 'Print', 'Irish Times', 'Half page (€8,500) — Wed 01 Jul', date '2026-07-01', date '2026-07-01', null, 'New Copy', 7327.38, 10, 7327.38
  union all select (select id from c where ref='AE-2605'), 'RAN0098', 'Print', 'Irish Times', 'Half page (€8,500) — Thu 09 Jul', date '2026-07-09', date '2026-07-09', null, 'Repeat Copy', 7327.38, 10, 7327.38
  union all select (select id from c where ref='AE-2605'), 'RAN0098','Print', 'Irish Times', 'Half page (€8,500) — Thu 16 Jul', date '2026-07-16', date '2026-07-16', null, 'Repeat Copy', 7327.38, 10, 7327.38

  -- AE-2606 Telegraph & Mail (RAN0099 Mail Metro Media)
  union all select (select id from c where ref='AE-2606'), 'RAN0099', 'Print', 'MMM', 'Daily Telegraph Full Page RH Front Half — Thu 09 Jul', date '2026-07-09', date '2026-07-09', null, 'Repeat Copy', 10000.00, 15, 10000.00
  union all select (select id from c where ref='AE-2606'), 'RAN0099','Print', 'MMM', 'Daily Telegraph Full Page RH Front Half — Thu 16 Jul', date '2026-07-16', date '2026-07-16', null, 'Repeat Copy', 10000.00, 15, 10000.00
  union all select (select id from c where ref='AE-2606'), 'RAN0099','Print', 'MMM', 'Daily Mail Quarter Page Display TV — Tue 07 Jul',      date '2026-07-07', date '2026-07-07', null, 'Repeat Copy', 4000.00, 15, 4000.00

  -- AE-2607 Glasgow (RAN0100 + RAN0101 Global)
  union all select (select id from c where ref='AE-2607'), 'RAN0100', 'OOH', 'Global OOH', 'x232 Streethubs — Glasgow',   date '2026-07-23', date '2026-08-02', null, 'New Copy', 5267.44, 15, 5267.44
  union all select (select id from c where ref='AE-2607'), 'RAN0101', 'OOH', 'Global OOH', 'x100 Streetliners — Glasgow', date '2026-07-20', date '2026-08-02', null, 'New Copy', 3500.00, 15, 3500.00
  union all select (select id from c where ref='AE-2607'), 'RAN0101','Creative', 'Global OOH', 'Production on Streetliners', date '2026-07-20', date '2026-07-20', null, 'New Copy', 2400.00, 0, 2400.00
  union all select (select id from c where ref='AE-2607'), 'RAN0101','OOH', 'Global OOH', 'x2 D6s — Glasgow Airport',    date '2026-07-23', date '2026-08-02', null, 'New Copy', 858.00, 15, 858.00
) v
where not exists (select 1 from campaign_lines where supplier_po = 'RAN0091');

-- --------------------------------------------------- client invoices -------
-- The four in the run that belong to RAN0091–0101.
with c as (select ref, id from campaigns where ref between 'AE-2601' and 'AE-2607')
insert into client_invoices (campaign_id, invoice_no, invoice_date, amount_ex_vat, status)
select * from (
  select (select id from c where ref='AE-2601'), '18790', date '2026-06-30', 3558.00,  'Sent'
  union all select (select id from c where ref='AE-2602'), '18788', date '2026-06-30', 14000.00, 'Sent'
  union all select (select id from c where ref='AE-2604'), '18789', date '2026-06-30', 12000.00, 'Sent'
  union all select (select id from c where ref='AE-2605'), '18781', date '2026-06-29', 7327.38,  'Sent'
) v
on conflict (invoice_no) do nothing;

-- ------------------------------------------------------------ counters -----
-- Supplier POs continue from RAN0101; client invoices continue from 18792.
insert into po_counters (prefix, last_number) values ('RAN', 101)
on conflict (prefix) do update set last_number = greatest(po_counters.last_number, 101);
insert into po_counters (prefix, last_number) values ('INV', 18792)
on conflict (prefix) do update set last_number = greatest(po_counters.last_number, 18792);

select 'Randox import complete' as result,
       (select count(*) from campaigns where ref between 'AE-2601' and 'AE-2607') as campaigns,
       (select count(*) from campaign_lines where supplier_po like 'RAN%') as lines,
       (select count(*) from client_invoices) as invoices;
