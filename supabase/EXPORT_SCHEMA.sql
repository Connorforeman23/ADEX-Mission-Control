-- Read-only. Describes the live database's structure so the repository can be
-- compared against it. Returns one text column; changes nothing.

with parts as (
  -- Tables and whether row-level security is on
  select 1 as ord, format('TABLE  %-20s  rls=%s',
           c.relname, case when c.relrowsecurity then 'ON' else 'OFF' end) as line
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'

  union all
  -- Columns: type, nullability, default
  select 2, format('COL    %-20s %-18s %-9s %s%s',
           table_name, column_name, data_type,
           case when is_nullable = 'NO' then 'NOT NULL' else 'null' end,
           case when column_default is not null then '  default=' || column_default else '' end)
  from information_schema.columns
  where table_schema = 'public'

  union all
  -- Constraints: primary keys, foreign keys, unique, checks
  select 3, format('CONS   %-20s %-24s %s',
           tc.table_name, tc.constraint_type, tc.constraint_name)
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'

  union all
  -- RLS policies with their expressions
  select 4, format('POLICY %-20s cmd=%-7s  using=(%s)  check=(%s)',
           tablename, cmd, coalesce(qual, '-'), coalesce(with_check, '-'))
  from pg_policies where schemaname = 'public'

  union all
  -- Triggers
  select 5, format('TRIG   %-20s %s',
           c.relname, t.tgname)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal

  union all
  -- Functions and whether they run as SECURITY DEFINER
  select 6, format('FUNC   %-24s %s',
           p.proname, case when p.prosecdef then 'security definer' else 'invoker' end)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select line from parts order by ord, line;
