-- ADEX Mission Control — 0020: monthly invoicing, and a time on a task
--
-- 1. MONTHLY INVOICING (decision B, 16 Sept). Randox books campaigns that run
--    over several months, and wants an invoice per month rather than one at
--    the end. The rule Connor set is deliberately simple and does NOT split a
--    line across months:
--
--      A line is invoiced WHOLE, in the month it runs. At the end of September
--      ADEX invoices everything running in October — so a line that starts and
--      finishes inside October is invoiced then, and nothing else is.
--
--    It is per client, off by default: everyone else keeps one invoice per
--    campaign. The invoice records which month it covers, so a campaign can
--    carry several invoices without them being mistaken for duplicates.
--
-- 2. TASK TIME. A task has a date; some need an hour too ("call Randox at
--    10:30"), and that is what a calendar entry will be built from later.
--    Optional — a task with no time is still just a day's work.
--
-- Safe to re-run.

alter table organisations add column if not exists monthly_invoicing boolean not null default false;

alter table client_invoices add column if not exists period_month date;
comment on column client_invoices.period_month is
  'First day of the month this invoice covers, for clients invoiced monthly. Null = the whole campaign.';

create index if not exists client_invoices_period_idx
  on client_invoices (campaign_id, period_month);

alter table tasks add column if not exists due_time time;

notify pgrst, 'reload schema';
select '0020_monthly_invoicing_and_task_time complete' as result;
