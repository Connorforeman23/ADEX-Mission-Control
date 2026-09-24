-- ADEX Mission Control — production cut-over, 24 Sept 2026
-- Migrations 0017 to 0019 in order. Every one is safe to re-run, so if
-- anything stops part-way, fix the cause and run the whole file again.
--
-- RUN THIS BEFORE MERGING. The new code reads these columns; merging first
-- would break Organisations, Tasks and the invoice preview until it lands.
--
-- Expected final result:  '0019_org_terms_and_order_email complete'

-- ======================================================================
-- 0017_line_commission_website_unique
-- ======================================================================
-- ADEX Mission Control — 0017: website is unique; commission override noted
--
-- Rick's review, September 2026:
--
--   * A website identifies a company better than its name does — "Randox" and
--     "Randox Laboratories Ltd" are one company, and randox.com proves it.
--     Two organisations with the same site are a duplicate, so the site is
--     unique. Stored normalised (no scheme, no www, lower case) by the app,
--     and the index is case-insensitive to be safe.
--
--   * Commission can now be set per line (the GW deal at 10%). No schema
--     change: campaign_lines.commission_pct has existed since 0001 and
--     supplier_net is generated from it. The app simply lets it be edited.
--
-- Safe to re-run.

create unique index if not exists organisations_website_unique
  on organisations (lower(website))
  where website is not null and website <> '';

notify pgrst, 'reload schema';
select '0017_line_commission_website_unique complete' as result;

-- ======================================================================
-- 0018_tasks_organisation
-- ======================================================================
-- ADEX Mission Control — 0018: a task can be about any organisation
--
-- Rick: "chase Plug for the Modern Milkman proposal" is a task about a
-- SUPPLIER, but the task form only offered clients — it read the old clients
-- table. Tasks now point at an organisation, which is any company we deal
-- with. client_id stays for the tasks that already have one; new tasks set
-- organisation_id.
-- Safe to re-run.

alter table tasks add column if not exists organisation_id uuid references organisations (id) on delete set null;
create index if not exists tasks_organisation_idx on tasks (organisation_id);

-- Carry existing client links across by name, so nothing loses its "about".
update tasks t
   set organisation_id = o.id
  from clients c
  join organisations o on lower(trim(o.name)) = lower(trim(c.name))
 where t.client_id = c.id and t.organisation_id is null;

notify pgrst, 'reload schema';
select '0018_tasks_organisation complete' as result;

-- ======================================================================
-- 0019_org_terms_and_order_email
-- ======================================================================
-- ADEX Mission Control — 0019: payment terms and Space Order addresses
--
-- Rick's review, September 2026:
--
--   * Payment terms per organisation, for clients and suppliers alike:
--     30 / 45 / 60 days, counted from the date of publication or from the
--     end of the month. A client's terms set the due date on their invoices;
--     with none recorded, the invoice keeps the house default (dated month
--     end, due the 25th of the next). A supplier's terms print on the order.
--
--   * Where a supplier's Space Orders go. One or more addresses on the
--     supplier; Lynsey and Steve are copied on every order (app constant,
--     not per supplier). Used by the order sheet today and by "send from the
--     CRM" (4.4) when that lands.
--
-- Safe to re-run.

alter table organisations add column if not exists payment_terms_days integer
  check (payment_terms_days is null or payment_terms_days in (30, 45, 60));
alter table organisations add column if not exists payment_terms_basis text
  check (payment_terms_basis is null or payment_terms_basis in ('publication', 'month_end'));
alter table organisations add column if not exists order_email text;

notify pgrst, 'reload schema';
select '0019_org_terms_and_order_email complete' as result;

