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
  select 'AE-2603', 'M4 Tower — 6 month package',   client_id, 'booked', owner_id, 'London',   date '2026-09-07', date '2027-04-04', 0, null,     'RAN0094 bursts + RAN0097 extra creative. Client rate to confirm before invoicing.' from me
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
  union all select (select id from c where ref='AE-2603'), 'RAN0094',  'OOH', 'JCD', 'M4 Tower Outbound — burst 1', date '2026-09-07', date '2026-10-04', null, 'New Copy', 4600.00, 15, 4600.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 2', date '2026-10-19', date '2026-11-15', null, 'Repeat Copy', 5000.00, 15, 5000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 3', date '2026-11-30', date '2026-12-27', null, 'Repeat Copy', 5000.00, 15, 5000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 4', date '2026-12-28', date '2027-01-24', null, 'Repeat Copy', 5000.00, 15, 5000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 5', date '2027-01-25', date '2027-02-21', null, 'Repeat Copy', 5000.00, 15, 5000.00
  union all select (select id from c where ref='AE-2603'), 'RAN0094', 'OOH', 'JCD', 'M4 Tower Outbound — burst 6', date '2027-02-22', date '2027-04-04', null, 'Repeat Copy', 5000.00, 15, 5000.00
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
