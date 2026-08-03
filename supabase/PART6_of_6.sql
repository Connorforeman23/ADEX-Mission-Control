-- ADEX Randox import - part 6 of 6
-- Run the parts IN ORDER. Each is safe to re-run.

-- booking lines 151-157 of 157
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2595'), 'RAN0099', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Telegraph', date '2026-07-09', date '2026-07-09', 'New Copy', 10000, 15, 10000
  union all select (select id from campaigns where ref='AE-2595'), 'RAN0099', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Telegraph', date '2026-07-16', date '2026-07-16', 'New Copy', 10000, 15, 10000
  union all select (select id from campaigns where ref='AE-2595'), 'RAN0099', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Mail', date '2026-07-07', date '2026-07-07', 'New Copy', 4000, 15, 4000
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0100', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-23', date '2026-08-02', 'New Copy', 5267.44, 15, 5267.44
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0101', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-20', date '2026-08-02', 'New Copy', 3500, 15, 3500
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0101', 'Karima Dernawi', 'production', 'OOH', 'Global OOH', 'Production on above', date '2026-07-20', date '2026-08-02', 'New Copy', 2400, 0, 2400
  union all select (select id from campaigns where ref='AE-2596'), 'RAN0101', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-23', date '2026-08-02', 'New Copy', 858, 15, 858
) v;

-- client invoices (Sage), with payment status
-- The Sage report distinguishes paid from unpaid, which the original
-- constraint did not allow.
alter table client_invoices drop constraint if exists client_invoices_status_check;

alter table client_invoices add constraint client_invoices_status_check
  check (status in ('Draft','Sent','Paid','Unpaid','Overdue','Cancelled'));

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
