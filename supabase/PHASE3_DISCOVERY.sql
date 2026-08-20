-- Phase 3.1 — read-only data discovery. Run on production. Nothing is modified.
-- Each query answers one of the discovery questions about the live data.

-- === 1. Digest: sizes and the key overlaps =================================
select 'clients (companies as customers)' as finding, count(*)::text as value from clients
union all select 'leads (companies as prospects)', count(*)::text from leads
union all select 'contacts (people)', count(*)::text from contacts
union all select 'distinct supplier vendors (free text)', count(distinct vendor)::text from campaign_lines
union all select 'companies in BOTH leads and clients',
  count(*)::text from (select 1 from clients c join leads l on lower(trim(c.name)) = lower(trim(l.name))) x
union all select 'client names that are also vendor names',
  count(distinct c.name)::text from clients c join campaign_lines cl on lower(trim(c.name)) = lower(trim(cl.vendor))
union all select 'contacts whose org matches no client/lead',
  count(*)::text from contacts ct
   where not exists (select 1 from clients c where lower(trim(c.name)) = lower(trim(ct.organisation)))
     and not exists (select 1 from leads l where lower(trim(l.name)) = lower(trim(ct.organisation)))
union all select 'contacts with no client_id and no lead_id',
  count(*)::text from contacts where client_id is null and lead_id is null;

-- === 2. Status vocabularies in use ========================================
-- select 'client status: '||coalesce(status,'(null)') as bucket, count(*) from clients group by status
-- union all select 'lead stage: '||coalesce(stage,'(null)'), count(*) from leads group by stage
-- union all select 'contact status: '||coalesce(status,'(null)'), count(*) from contacts group by status
-- order by bucket;

-- === 3. Companies in both leads and clients (dedup candidates) =============
-- select c.name from clients c join leads l on lower(trim(c.name)) = lower(trim(l.name)) order by c.name;

-- === 4. Client names that are also supplier vendors (client+supplier) ======
-- select distinct c.name from clients c
--   join campaign_lines cl on lower(trim(c.name)) = lower(trim(cl.vendor)) order by c.name;

-- === 5. All distinct supplier vendors (eyeball for mis-filed clients) =======
-- select distinct vendor from campaign_lines order by vendor;

-- Run query 1 first; uncomment 2–5 (one at a time) to drill into whatever
-- query 1 flags as non-zero.
