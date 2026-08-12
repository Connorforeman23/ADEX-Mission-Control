-- ADEX Mission Control — security self-check (work package 1.6)
-- Read-only. Run on any database (prod or dev); EVERY row should read PASS.
-- Any FAIL means a control from 1.1–1.5 is missing on that database.

with checks as (
  -- 1.1 — privilege guard
  select '1.1 role-guard trigger' as control,
    exists (select 1 from pg_trigger where tgname = 'guard_profile_fields_trg') as ok
  union all select '1.1 guard function',
    exists (select 1 from pg_proc where proname = 'guard_profile_fields')

  -- 1.2 — authentication & administration
  union all select '1.2 signup allow-list trigger',
    exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')
  union all select '1.2 is_admin()',
    exists (select 1 from pg_proc where proname = 'is_admin')
  union all select '1.2 admin_add_staff()',
    exists (select 1 from pg_proc where proname = 'admin_add_staff')
  union all select '1.2 admin_set_role()',
    exists (select 1 from pg_proc where proname = 'admin_set_role')
  union all select '1.2 admin_remove_staff()',
    exists (select 1 from pg_proc where proname = 'admin_remove_staff')
  union all select '1.2 staff_roles RLS on',
    exists (select 1 from pg_class where relname = 'staff_roles' and relrowsecurity)
  union all select '1.2 staff_roles locked (no policy)',
    not exists (select 1 from pg_policies where tablename = 'staff_roles')

  -- 1.3 — access model
  union all select '1.3 is_restricted()',
    exists (select 1 from pg_proc where proname = 'is_restricted')
  union all select '1.3 can_see_client()',
    exists (select 1 from pg_proc where proname = 'can_see_client')
  union all select '1.3 restricted campaigns policy',
    exists (select 1 from pg_policies where tablename = 'campaigns' and policyname ilike '%owner or full staff%')

  -- 1.4 — financial integrity
  union all select '1.4 non-negative supplier gross',
    exists (select 1 from pg_constraint where conname = 'ck_lines_gross_nonneg')
  union all select '1.4 non-negative client charge',
    exists (select 1 from pg_constraint where conname = 'ck_lines_charge_nonneg')
  union all select '1.4 commission 0-100',
    exists (select 1 from pg_constraint where conname = 'ck_lines_commission_range')
  union all select '1.4 line date order',
    exists (select 1 from pg_constraint where conname = 'ck_lines_date_order')
  union all select '1.4 campaigns money non-negative',
    exists (select 1 from pg_constraint where conname = 'ck_campaigns_money_nonneg')
  union all select '1.4 client invoice non-negative',
    exists (select 1 from pg_constraint where conname = 'ck_client_inv_amount_nonneg')
  union all select '1.4 delete-invoiced guard trigger',
    exists (select 1 from pg_trigger where tgname = 'prevent_delete_invoiced_campaign_trg')

  -- 1.5 — audit & offboarding
  union all select '1.5 audit_log table',
    exists (select 1 from information_schema.tables where table_name = 'audit_log')
  union all select '1.5 audit_log admins-only read',
    exists (select 1 from pg_policies where tablename = 'audit_log' and policyname = 'audit read admins')
  union all select '1.5 audit trigger on campaigns',
    exists (select 1 from pg_trigger where tgname = 'audit_trg' and tgrelid = 'campaigns'::regclass)
  union all select '1.5 audit trigger on client_invoices',
    exists (select 1 from pg_trigger where tgname = 'audit_trg' and tgrelid = 'client_invoices'::regclass)
  union all select '1.5 audit trigger on profiles',
    exists (select 1 from pg_trigger where tgname = 'audit_trg' and tgrelid = 'profiles'::regclass)
  union all select '1.5 profiles.active column',
    exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'active')
  union all select '1.5 admin_set_active()',
    exists (select 1 from pg_proc where proname = 'admin_set_active')

  -- Row-level security on the sensitive tables
  union all select 'RLS on campaigns',
    exists (select 1 from pg_class where relname = 'campaigns' and relrowsecurity)
  union all select 'RLS on client_invoices',
    exists (select 1 from pg_class where relname = 'client_invoices' and relrowsecurity)
  union all select 'RLS on supplier_invoices',
    exists (select 1 from pg_class where relname = 'supplier_invoices' and relrowsecurity)
  union all select 'RLS on audit_log',
    exists (select 1 from pg_class where relname = 'audit_log' and relrowsecurity)
)
select control, case when ok then 'PASS' else 'FAIL' end as status
from checks
order by control;
