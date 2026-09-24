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
