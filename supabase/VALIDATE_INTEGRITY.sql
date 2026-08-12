-- Pre-flight for migration 0004. Run this on the target database BEFORE applying
-- 0004_integrity.sql. Every row of the 'violations' column must be 0.
-- If any is non-zero, that existing data would break the new constraint — fix
-- the data (or reconsider the rule) before applying the migration.

select 'campaign_lines.supplier_gross < 0'        as check, count(*) as violations from campaign_lines where supplier_gross < 0
union all select 'campaign_lines.client_charge < 0',        count(*) from campaign_lines where client_charge < 0
union all select 'campaign_lines.cpt < 0',                  count(*) from campaign_lines where cpt is not null and cpt < 0
union all select 'campaign_lines.commission_pct out of 0-100', count(*) from campaign_lines where commission_pct < 0 or commission_pct > 100
union all select 'campaign_lines.end_date < start_date',    count(*) from campaign_lines where end_date < start_date
union all select 'campaigns.fee/billed/cpl/leads < 0',      count(*) from campaigns where fee < 0 or billed < 0 or cpl < 0 or leads < 0
union all select 'supplier_invoices.amount < 0',            count(*) from supplier_invoices where amount < 0
union all select 'client_invoices.amount_ex_vat < 0',       count(*) from client_invoices where amount_ex_vat < 0
union all select 'client_invoices.outstanding < 0',         count(*) from client_invoices where outstanding < 0
union all select 'leads.value < 0',                         count(*) from leads where value < 0
order by check;
