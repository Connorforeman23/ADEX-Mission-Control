-- Remove duplicate booking lines left by running an import part twice.
-- Two lines count as the same booking only if every meaningful field matches,
-- so genuine repeats -- the six identical Train Card bursts on different dates,
-- or several production charges on one burst at different amounts -- survive.

with ranked as (
  select ctid,
         row_number() over (
           partition by campaign_id, supplier_po, coalesce(detail, ''), line_type,
                        channel, vendor, start_date, end_date,
                        supplier_gross, client_charge
           order by ctid
         ) as copy_no
  from campaign_lines
  where supplier_po like 'RAN%'
)
delete from campaign_lines
where ctid in (select ctid from ranked where copy_no > 1);

-- What's left
select
  (select count(*) from campaign_lines where supplier_po like 'RAN%') as booking_lines,
  (select count(distinct supplier_po) from campaign_lines where supplier_po like 'RAN%') as distinct_pos,
  (select count(*) from campaigns where ref between 'AE-2578' and 'AE-2596') as campaigns,
  (select count(*) from client_invoices) as invoices;
