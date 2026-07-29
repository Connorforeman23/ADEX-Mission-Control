-- ADEX Mission Control — security check
--
-- Run this any time to confirm the database is locked down. Every table
-- should report rls_enabled = true. staff_roles deliberately has no policy:
-- it is only ever reached through security-definer functions, so denying all
-- direct access is correct.
--
-- Safe to run repeatedly; it changes nothing except enabling RLS if missing.

alter table staff_roles enable row level security;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
where n.nspname = 'public'
  and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relrowsecurity, c.relname;
