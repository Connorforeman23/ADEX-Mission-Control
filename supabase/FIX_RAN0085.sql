-- RAN0085 Mancunian Arch carries two production charges of GBP 325 -- one at
-- 6 April and one at 13 July, per the order's copy note. Neither row repeats
-- its dates in the table, so both inherited the media line's range, became
-- identical, and the dedupe removed one. This restores them with their real
-- dates. Safe to re-run.

-- First charge: 6 April
update campaign_lines
set start_date = date '2026-04-06', end_date = date '2026-04-06',
    detail = 'Production - 6 April'
where supplier_po = 'RAN0085' and line_type = 'production';

-- Second charge: 13 July, added back if it isn't already there
insert into campaign_lines
  (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail,
   start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select c.id, 'RAN0085', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production - 13 July',
       date '2026-07-13', date '2026-07-13', 'New Copy', 325, 0, 325
from campaigns c
where c.ref = 'AE-2584'
  and not exists (
    select 1 from campaign_lines l
    where l.supplier_po = 'RAN0085' and l.detail = 'Production - 13 July'
  );

select
  (select count(*) from campaign_lines where supplier_po like 'RAN%') as booking_lines,
  (select count(distinct supplier_po) from campaign_lines where supplier_po like 'RAN%') as distinct_pos,
  (select count(*) from campaigns where ref between 'AE-2578' and 'AE-2596') as campaigns,
  (select count(*) from client_invoices) as invoices;
