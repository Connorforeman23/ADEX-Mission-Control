-- ADEX Mission Control — 0012: campaign references from a counter
--
-- Rick hit "duplicate key value violates unique constraint campaigns_ref_key"
-- on his second booking. Cause: references were derived by taking the highest
-- existing ref and adding one — but sorted as TEXT. With the seeded TST-0001..
-- TST-0005 campaigns present, "T" sorts after "A", so the highest was always
-- TST-0005, which strips to 0005, so every new campaign was offered AE-6.
-- The first booking took AE-6; the second collided.
--
-- Text sorting would break anyway at the 999→1000 boundary ("AE-999" sorts
-- above "AE-1000"), and two people booking at once could read the same maximum.
-- A counter fixes all three: it is atomic and never re-reads existing rows.
--
-- Seeded from the highest existing AE- reference so numbering continues rather
-- than restarting. Safe to re-run.

create or replace function next_campaign_ref()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
  seed integer;
begin
  -- Highest AE- reference already used; TST- and other prefixes are ignored.
  select coalesce(
           max(nullif(regexp_replace(ref, '\D', '', 'g'), '')::integer),
           2600
         )
    into seed
    from campaigns
   where ref like 'AE-%';

  insert into po_counters (prefix, last_number)
  values ('CAMPAIGN_REF', greatest(seed, 2600) + 1)
  on conflict (prefix) do update
    set last_number = po_counters.last_number + 1
  returning last_number into n;

  return 'AE-' || n;
end;
$$;
grant execute on function next_campaign_ref() to authenticated;

notify pgrst, 'reload schema';
-- Deliberately not calling next_campaign_ref() here: it consumes a number, and
-- a migration should not burn a reference just to report success.
select '0012_campaign_ref_counter complete' as result;
