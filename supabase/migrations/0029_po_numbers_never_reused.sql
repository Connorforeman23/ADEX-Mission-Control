-- ADEX Mission Control — 0029: a PO number is never issued twice
--
-- Connor: "if we have a client that has orders in the file saved as PO number
-- ADE0006 can the system realise that it's linked to that client and then save
-- as the next numerical number from that generated PO?"
--
-- It already continued a client's sequence — but only for numbers IT had
-- issued. po_counters was the sole memory, so a client whose ADE0001-ADE0006
-- were raised in Sage would start again at ADE0001 here, and two different
-- orders would go to suppliers carrying the same number. That is the kind of
-- fault nobody notices until a supplier queries an invoice.
--
-- The counter now defers to the data: before issuing, it looks at the highest
-- number any line already carries for that prefix and starts above it,
-- whatever put it there — this CRM, an import, or a hand correction. The
-- counter is still the fast path; the scan is the safety net.
--
-- Numbers already in Sage but NOT in the CRM cannot be seen this way, so set
-- the starting point by hand, once per client, before raising their first
-- order here:
--
--   insert into po_counters (prefix, last_number) values ('ADE', 6)
--   on conflict (prefix) do update
--     set last_number = greatest(po_counters.last_number, excluded.last_number);
--
-- That says "ADE has reached 0006", and the next order issued is ADE0007.
-- greatest() means running it twice, or with too low a number, cannot wind a
-- sequence backwards.
--
-- Safe to re-run.

create or replace function next_po_number(p_prefix text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
  used integer;
  pfx text;
begin
  -- Letters only. The caller is any authenticated user and this runs as the
  -- definer, so the prefix must never reach the pattern below as given.
  pfx := upper(regexp_replace(coalesce(p_prefix, ''), '[^A-Za-z]', '', 'g'));
  if pfx = '' then
    pfx := 'ADX';
  end if;

  -- The highest number already in use for this prefix, whoever issued it.
  select coalesce(max((regexp_replace(supplier_po, '^' || pfx, ''))::integer), 0)
    into used
    from campaign_lines
   where supplier_po ~ ('^' || pfx || '[0-9]+$');

  insert into po_counters (prefix, last_number)
  values (pfx, used + 1)
  on conflict (prefix) do update
    set last_number = greatest(po_counters.last_number, used) + 1
  returning last_number into n;

  return pfx || lpad(n::text, 4, '0');
end;
$$;

grant execute on function next_po_number(text) to authenticated;

-- Bring the counters up to date with everything already on the books, so the
-- first order raised after this migration is right even without the scan.
insert into po_counters (prefix, last_number)
select upper(substring(supplier_po from '^[A-Z]+')),
       max((regexp_replace(supplier_po, '^[A-Z]+', ''))::integer)
  from campaign_lines
 where supplier_po ~ '^[A-Z]+[0-9]+$'
 group by 1
on conflict (prefix) do update
  set last_number = greatest(po_counters.last_number, excluded.last_number);

notify pgrst, 'reload schema';
select '0029_po_numbers_never_reused complete' as result;
