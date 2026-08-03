-- ADEX Randox import - part 1 of 6
-- Run the parts IN ORDER. Each is safe to re-run.

-- ADEX Mission Control  Randox Health import (RAN0078RAN0101)
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
  select 'AE-2578', 'Global OOH 2026  GD sheets, TCPs & DEP', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London & SE', date '2025-12-29', date '2026-12-13', 0, 'RAN0078'
  union all select 'AE-2579', 'Train Card Panels 2026', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London & SE', date '2026-02-09', date '2026-12-13', 0, 'RAN0079'
  union all select 'AE-2580', 'Radio  Capital UK & Heart 80s', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2025-10-30', date '2025-11-30', 0, 'RAN0080 + RAN0081'
  union all select 'AE-2581', 'FTWM  Jan/Feb 26', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-01-10', date '2026-02-14', 0, 'RAN0082'
  union all select 'AE-2582', 'M4 Tower  MarAug 26', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', date '2026-03-09', date '2026-08-23', 0, 'RAN0083'
  union all select 'AE-2583', 'FTWM  Mar/Apr 26', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-03-07', date '2026-04-18', 0, 'RAN0084'
  union all select 'AE-2584', 'Mancunian Arch  30 weeks', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'Granada', date '2026-04-06', date '2026-11-02', 0, 'RAN0085'
  union all select 'AE-2585', 'FTWM  May/Jun 26', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-05-09', date '2026-06-20', 0, 'RAN0086'
  union all select 'AE-2586', 'Liverpool D6s', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'Granada', date '2026-03-30', date '2026-04-12', 0, 'RAN0087'
  union all select 'AE-2587', 'FTWM  MarJun 26 (x7)', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-03-28', date '2026-06-27', 0, 'RAN0088'
  union all select 'AE-2588', 'FTWM  Additional page 16 May', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-05-16', date '2026-05-16', 0, 'RAN0089'
  union all select 'AE-2589', 'Wimbledon Activation', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', date '2026-05-14', date '2026-05-14', 0, 'RAN0090'
  union all select 'AE-2590', 'Kingston OOH  Summer', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', date '2026-07-06', date '2026-08-23', 0, 'RAN0091 + RAN0092'
  union all select 'AE-2591', 'FTWM  Jul/Aug 26', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-04', date '2026-08-29', 0, 'RAN0093'
  union all select 'AE-2592', 'M4 Tower  6 month package', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'London', date '2026-01-25', date '2027-01-24', 0, 'RAN0094 + RAN0097'
  union all select 'AE-2593', 'Daily Telegraph  01 Jul', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-01', date '2026-07-01', 0, 'RAN0095'
  union all select 'AE-2594', 'Irish Times  July', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-01', date '2026-07-16', 0, 'RAN0096 + RAN0098'
  union all select 'AE-2595', 'Telegraph & Mail  w/c 06 Jul', (select id from clients where name='Randox Health'), 'done', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-07', date '2026-07-16', 0, 'RAN0099'
  union all select 'AE-2596', 'Glasgow OOH  Jul/Aug', (select id from clients where name='Randox Health'), 'live', (select id from profiles where lower(email)='connor.foreman@advertisingexcellence.co.uk'), 'National', date '2026-07-20', date '2026-08-02', 0, 'RAN0100 + RAN0101'
) v
on conflict (ref) do nothing;

-- Clear any earlier Randox import so this one is the single source of truth.
-- The first attempt created AE-2601..AE-2607, now superseded by AE-2590..AE-2596.
delete from campaigns where ref between 'AE-2601' and 'AE-2607';

delete from campaign_lines where supplier_po like 'RAN%';
