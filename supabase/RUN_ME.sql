-- ============================================================
-- ADEX Mission Control - run this once. Two parts:
--   1. Contacts table (new page)
--   2. Randox Health import - 24 POs, 19 campaigns, 40 invoices
-- Safe to re-run.
-- ============================================================

-- ADEX Mission Control  contacts for prospecting
-- People sit under an organisation; several contacts per organisation is
-- normal. A contact can point at a pipeline opportunity and, once won, the
-- client record. Safe to run more than once.

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  job_title text,
  organisation text not null,
  email text,
  phone text,
  mobile text,
  linkedin text,
  notes text,
  status text not null default 'Prospect'
    check (status in ('Prospect', 'Engaged', 'Client', 'Lapsed')),
  owner_id uuid references profiles(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contacts_org_idx on contacts (organisation);
create index if not exists contacts_owner_idx on contacts (owner_id);

alter table contacts enable row level security;

drop policy if exists "contacts visible to owner or full staff" on contacts;
create policy "contacts visible to owner or full staff" on contacts
  for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

select 'contacts ready' as result;

-- ============ PART 2: RANDOX IMPORT ============

-- ADEX Mission Control - Randox Health import (RAN0078-RAN0101)
-- Generated from the 24 supplier Space Orders. Client charge is set equal to
-- supplier gross throughout, pending the full invoice report.
-- Idempotent: re-running adds nothing that is already present.

alter table campaign_lines add column if not exists commission_pct numeric(5,2) not null default 15;
alter table campaign_lines add column if not exists supplier_contact text;
alter table campaign_lines add column if not exists line_type text not null default 'media'
  check (line_type in ('media','production'));
alter table campaign_lines drop column if exists supplier_net;
alter table campaign_lines add column supplier_net numeric(12,2)
  generated always as (round(supplier_gross * (1 - commission_pct / 100.0), 2)) stored;
drop index if exists campaign_lines_supplier_po_key;

insert into clients (name, sector, owner_id, status)
select 'Randox Health', 'Healthcare / diagnostics',
       (select id from profiles where lower(email) = 'connor.foreman@advertisingexcellence.co.uk'), 'live'
on conflict (name) do nothing;


-- campaigns
insert into campaigns (ref, name, client_id, status, owner_id, region, start_date, end_date, fee, note)
select * from (
  select 'AE-2578', 'Global OOH 2026 - GD sheets, TCPs & DEP', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London & SE', date '2025-12-29', date '2026-12-13', 0, 'RAN0078'
  union all select 'AE-2579', 'Train Card Panels 2026', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London & SE', date '2026-02-09', date '2026-12-13', 0, 'RAN0079'
  union all select 'AE-2580', 'Radio - Capital UK & Heart 80s', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2025-10-30', date '2025-11-30', 0, 'RAN0080 + RAN0081'
  union all select 'AE-2581', 'FTWM - Jan/Feb 26', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-01-10', date '2026-02-14', 0, 'RAN0082'
  union all select 'AE-2582', 'M4 Tower - Mar-Aug 26', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', date '2026-03-09', date '2026-08-23', 0, 'RAN0083'
  union all select 'AE-2583', 'FTWM - Mar/Apr 26', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-03-07', date '2026-04-18', 0, 'RAN0084'
  union all select 'AE-2584', 'Mancunian Arch - 30 weeks', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'Granada', date '2026-04-06', date '2026-11-02', 0, 'RAN0085'
  union all select 'AE-2585', 'FTWM - May/Jun 26', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-05-09', date '2026-06-20', 0, 'RAN0086'
  union all select 'AE-2586', 'Liverpool D6s', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'Granada', date '2026-03-30', date '2026-04-12', 0, 'RAN0087'
  union all select 'AE-2587', 'FTWM - Mar-Jun 26 (x7)', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-03-28', date '2026-06-27', 0, 'RAN0088'
  union all select 'AE-2588', 'FTWM - Additional page 16 May', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-05-16', date '2026-05-16', 0, 'RAN0089'
  union all select 'AE-2589', 'Wimbledon Activation', (select id from clients where name='Randox Health'), 'planning', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', null, null, 0, 'RAN0090'
  union all select 'AE-2590', 'Kingston OOH - Summer', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', date '2026-07-06', date '2026-08-23', 0, 'RAN0091 + RAN0092'
  union all select 'AE-2591', 'FTWM - Jul/Aug 26', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-04', date '2026-08-29', 0, 'RAN0093'
  union all select 'AE-2592', 'M4 Tower - 6 month package', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', date '2026-01-25', date '2027-01-24', 0, 'RAN0094 + RAN0097'
  union all select 'AE-2593', 'Daily Telegraph - 01 Jul', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-01', date '2026-07-01', 0, 'RAN0095'
  union all select 'AE-2594', 'Irish Times - July', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-01', date '2026-07-16', 0, 'RAN0096 + RAN0098'
  union all select 'AE-2595', 'Telegraph & Mail - w/c 06 Jul', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-07', date '2026-07-16', 0, 'RAN0099'
  union all select 'AE-2596', 'Glasgow OOH - Jul/Aug', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-20', date '2026-08-02', 0, 'RAN0100 + RAN0101'
) v
on conflict (ref) do nothing;

-- booking lines
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2025-12-29', date '2026-01-11', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2025-12-29', date '2026-01-11', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2025-12-29', date '2026-01-11', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2025-12-29', date '2026-01-11', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2025-12-29', date '2026-01-11', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2025-12-29', date '2026-01-11', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-02-09', date '2026-02-22', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-02-09', date '2026-02-22', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-03-09', date '2026-03-22', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-03-09', date '2026-03-22', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-03-09', date '2026-03-22', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-03-09', date '2026-03-22', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-03-09', date '2026-03-22', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-03-09', date '2026-03-22', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-04-06', date '2026-04-19', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-04-06', date '2026-04-19', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-05-04', date '2026-05-17', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-05-04', date '2026-05-17', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-05-04', date '2026-05-17', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-05-04', date '2026-05-17', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-05-04', date '2026-05-17', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-05-04', date '2026-05-17', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-06-01', date '2026-06-14', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-06-01', date '2026-06-14', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-07-13', date '2026-07-26', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-07-13', date '2026-07-26', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-07-13', date '2026-07-26', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-07-13', date '2026-07-26', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-07-13', date '2026-07-26', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-07-13', date '2026-07-26', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-08-10', date '2026-08-23', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-08-10', date '2026-08-23', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-09-07', date '2026-09-20', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-09-07', date '2026-09-20', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-09-07', date '2026-09-20', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-09-07', date '2026-09-20', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-09-07', date '2026-09-20', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-09-07', date '2026-09-20', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-10-05', date '2026-10-18', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-10-05', date '2026-10-18', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-11-30', date '2026-12-13', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-11-30', date '2026-12-13', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-02-09', date '2026-02-22', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', null, null, 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-04-06', date '2026-04-19', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', null, null, 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-06-01', date '2026-06-14', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', null, null, 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-08-10', date '2026-08-23', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', null, null, 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-10-05', date '2026-10-18', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', null, null, 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-11-30', date '2026-12-13', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', null, null, 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2580'), 'RAN0080', 'Karima Dernawi', 'media', 'Radio', 'Global OOH', 'Capital UK & Heart 80''s', date '2025-11-03', date '2025-11-30', 'New Copy', 20138, 15, 20138
  union all select (select id from campaigns where ref='AE-2580'), 'RAN0081', 'Dan Hearn', 'production', 'Creative', 'Treacle7', 'Production of Radio ad', date '2025-10-30', date '2025-11-30', 'New Copy', 1100, 0, 1100
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-01-10', date '2026-01-10', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-01-17', date '2026-01-17', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-02-07', date '2026-02-07', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-02-14', date '2026-02-14', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-03-09', date '2026-04-05', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-04-06', date '2026-05-03', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-05-04', date '2026-05-31', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-06-01', date '2026-06-28', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-06-29', date '2026-07-26', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-07-27', date '2026-08-23', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production', null, null, 'New Copy', 400, 0, 400
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-03-07', date '2026-03-07', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-03-21', date '2026-03-21', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-04', date '2026-04-04', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-18', date '2026-04-18', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2584'), 'RAN0085', 'Lee Capon', 'media', 'OOH', 'JCD', 'Media Cost', date '2026-04-06', date '2026-11-02', 'New Copy', 28600, 15, 28600
  union all select (select id from campaigns where ref='AE-2584'), 'RAN0085', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production', null, null, 'New Copy', 325, 0, 325
  union all select (select id from campaigns where ref='AE-2584'), 'RAN0085', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production', null, null, 'New Copy', 325, 0, 325
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-09', date '2026-05-09', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-23', date '2026-05-23', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-06', date '2026-06-06', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-20', date '2026-06-20', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2586'), 'RAN0087', 'Lee Capon', 'media', 'OOH', 'JCD', 'JCDecaux', date '2026-03-30', date '2026-04-12', 'New Copy', 5400, 15, 5400
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-03-28', date '2026-03-28', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-11', date '2026-04-11', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-25', date '2026-04-25', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-02', date '2026-05-02', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-30', date '2026-05-30', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-13', date '2026-06-13', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-27', date '2026-06-27', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2588'), 'RAN0089', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-16', date '2026-05-16', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2589'), 'RAN0090', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', null, null, 'New Copy', 4202.4, 15, 4202.4
  union all select (select id from campaigns where ref='AE-2589'), 'RAN0090', 'Karima Dernawi', 'production', 'OOH', 'Global OOH', 'Production on x1 48 Sheet', null, null, 'New Copy', 258, 0, 258
  union all select (select id from campaigns where ref='AE-2590'), 'RAN0091', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-13', date '2026-08-23', 'New Copy', 1200, 15, 1200
  union all select (select id from campaigns where ref='AE-2590'), 'RAN0091', 'Karima Dernawi', 'production', 'OOH', 'Global OOH', 'Production on x1 48 Sheet', null, null, 'New Copy', 258, 0, 258
  union all select (select id from campaigns where ref='AE-2590'), 'RAN0092', 'Lee Capon', 'media', 'OOH', 'JCD', 'JCDecaux', date '2026-07-06', date '2026-08-16', 'New Copy', 2100, 15, 2100
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-04', date '2026-07-04', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-11', date '2026-07-11', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-18', date '2026-07-18', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-25', date '2026-07-25', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-01', date '2026-08-01', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-08', date '2026-08-08', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-15', date '2026-08-15', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-22', date '2026-08-22', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-29', date '2026-08-29', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-09-07', date '2026-10-04', 'New Copy', 4600, 15, 4600
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-10-19', date '2026-11-15', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-11-30', date '2026-12-27', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-12-28', date '2027-01-24', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-01-25', date '2026-02-21', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-02-22', date '2026-04-04', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production x 2', null, null, 'New Copy', 800, 0, 800
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0097', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', null, null, 'New Copy', 400, 15, 400
  union all select (select id from campaigns where ref='AE-2593'), 'RAN0095', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Telegraph', date '2026-07-01', date '2026-07-01', 'New Copy', 12000, 15, 12000
  union all select (select id from campaigns where ref='AE-2594'), 'RAN0096', 'Daniel Roberts', 'media', 'Print', 'Irish Times', 'Irish Times', date '2026-07-01', date '2026-07-01', 'New Copy', 7327.38, 10, 7327.38
  union all select (select id from campaigns where ref='AE-2594'), 'RAN0098', 'Daniel Roberts', 'media', 'Print', 'Irish Times', 'Irish Times', date '2026-07-09', date '2026-07-09', 'New Copy', 7327.38, 10, 7327.38
  union all select (select id from campaigns where ref='AE-2594'), 'RAN0098', 'Daniel Roberts', 'media', 'Print', 'Irish Times', 'Irish Times', date '2026-07-16', date '2026-07-16', 'New Copy', 7327.38, 10, 7327.38
  union all select (select id from campaigns where ref='AE-2595'), 'RAN0099', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Telegraph', date '2026-07-09', date '2026-07-09', 'New Copy', 10000, 15, 10000
  union all select (select id from campaigns where ref='AE-2595'), 'RAN0099', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Telegraph', date '2026-07-16', date '2026-07-16', 'New Copy', 10000, 15, 10000
  union all select (select id from campaigns where ref='AE-2595'), 'RAN0099', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Mail', date '2026-07-07', date '2026-07-07', 'New Copy', 4000, 15, 4000
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0100', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-23', date '2026-08-02', 'New Copy', 5267.44, 15, 5267.44
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0101', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-20', date '2026-08-02', 'New Copy', 3500, 15, 3500
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0101', 'Karima Dernawi', 'production', 'OOH', 'Global OOH', 'Production on above', null, null, 'New Copy', 2400, 0, 2400
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0101', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-23', date '2026-08-02', 'New Copy', 858, 15, 858
) v
where not exists (select 1 from campaign_lines cl where cl.supplier_po like 'RAN%');

-- client invoices (Sage), with payment status
alter table client_invoices add column if not exists client_id uuid references clients(id) on delete cascade;
alter table client_invoices add column if not exists outstanding numeric(12,2) not null default 0;
alter table client_invoices alter column campaign_id drop not null;
insert into client_invoices (invoice_no, invoice_date, amount_ex_vat, outstanding, status, client_id, campaign_id)
select * from (
  select '18664', date '2026-01-30', 19384, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2578')
  union all select '18665', date '2026-01-30', 7000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18666', date '2026-01-30', 12000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2579')
  union all select '18683', date '2026-02-27', 72995, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2578')
  union all select '18684', date '2026-02-27', 6000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2592')
  union all select '18685', date '2026-02-27', 7000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18708', date '2026-03-31', 19384, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2578')
  union all select '18709', date '2026-03-31', 6000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2592')
  union all select '18710', date '2026-03-31', 7000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18711', date '2026-03-31', 5091.67, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2584')
  union all select '18712', date '2026-03-31', 5400, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2586')
  union all select '18713', date '2026-03-31', 10500, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18729', date '2026-04-30', 72995, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2578')
  union all select '18730', date '2026-04-30', 6000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2592')
  union all select '18731', date '2026-04-30', 4766.67, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2584')
  union all select '18732', date '2026-04-30', 7000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18733', date '2026-04-30', 7000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18754', date '2026-05-29', 19384, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2578')
  union all select '18755', date '2026-05-29', 12000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2579')
  union all select '18756', date '2026-05-29', 6000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2592')
  union all select '18757', date '2026-05-29', 4766.67, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2584')
  union all select '18758', date '2026-05-29', 14000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18781', date '2026-06-29', 7327.38, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2594')
  union all select '18785', date '2026-06-30', 72995, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2578')
  union all select '18786', date '2026-06-30', 6000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2592')
  union all select '18787', date '2026-06-30', 5091.67, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2584')
  union all select '18788', date '2026-06-30', 14000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18789', date '2026-06-30', 12000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2593')
  union all select '18790', date '2026-06-30', 3558, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2590')
  union all select '18791', date '2026-06-30', 4460, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2589')
  union all select '18792', date '2026-06-30', 3500, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18796', date '2026-07-03', 25000, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2593')
  union all select '18797', date '2026-07-03', 14549.02, 0.00, 'Paid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2594')
  union all select '18810', date '2026-07-31', 35658, 42789.60, 'Unpaid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2578')
  union all select '18811', date '2026-07-31', 12000, 14400.00, 'Unpaid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2579')
  union all select '18812', date '2026-07-31', 6000, 7200.00, 'Unpaid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2592')
  union all select '18813', date '2026-07-31', 4766.67, 5720.00, 'Unpaid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2584')
  union all select '18814', date '2026-07-31', 17500, 21000.00, 'Unpaid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2591')
  union all select '18816', date '2026-07-31', 6728, 8073.60, 'Unpaid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2596')
  union all select '18817', date '2026-07-31', 6680, 8016.00, 'Unpaid', (select id from clients where name='Randox Health'), (select id from campaigns where ref='AE-2596')
) v
on conflict (invoice_no) do update set
  outstanding = excluded.outstanding, status = excluded.status;

insert into po_counters (prefix, last_number) values ('INV', 18817)
on conflict (prefix) do update set last_number = greatest(po_counters.last_number, 18817);

-- counters continue from the last order
insert into po_counters (prefix, last_number) values ('RAN', 101)
on conflict (prefix) do update set last_number = greatest(po_counters.last_number, 101);

select 'Randox import complete' as result,
       (select count(*) from campaigns where ref between 'AE-2578' and 'AE-2596') as campaigns,
       (select count(*) from campaign_lines where supplier_po like 'RAN%') as booking_lines,
       (select count(distinct supplier_po) from campaign_lines where supplier_po like 'RAN%') as distinct_pos;