-- Merge every "Randox…" client record (Randox, Randox Health, any casing)
-- into a single client named Randox. Campaigns, booking lines, creative,
-- tasks and invoices all follow their campaign's client, so repointing the
-- campaigns merges the media plan and finance views automatically.
-- Safe to run more than once.

do $$
declare
  keep uuid;
  dup record;
begin
  -- Prefer the row already called exactly Randox; otherwise take the oldest
  -- Randox-ish row and rename it.
  select id into keep from clients where lower(name) = 'randox' limit 1;
  if keep is null then
    select id into keep from clients where lower(name) like 'randox%' order by created_at limit 1;
    update clients set name = 'Randox' where id = keep;
  end if;

  for dup in select id, name from clients where lower(name) like 'randox%' and id <> keep loop
    update campaigns      set client_id = keep where client_id = dup.id;
    update creative_items set client_id = keep where client_id = dup.id;
    update tasks          set client_id = keep where client_id = dup.id;
    delete from clients where id = dup.id;
    raise notice 'merged % into Randox', dup.name;
  end loop;
end $$;

select c.name,
       (select count(*) from campaigns k where k.client_id = c.id) as campaigns,
       (select count(*) from creative_items i where i.client_id = c.id) as creative_items
from clients c
where lower(c.name) like 'randox%';
