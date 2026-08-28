-- ADEX Mission Control — 0011: organisation contact details
--
-- Organisations had a name, sector, owner and status but no way to reach them.
-- An address is needed on supplier orders and client invoices regardless, so
-- it belongs on the master company record rather than being retyped.
--
-- companies_house_no and website already exist from 0006 but were never
-- surfaced; the editor added alongside this migration exposes them.
-- Safe to re-run.

alter table organisations add column if not exists address_line1 text;
alter table organisations add column if not exists address_line2 text;
alter table organisations add column if not exists city text;
alter table organisations add column if not exists postcode text;
alter table organisations add column if not exists country text;
alter table organisations add column if not exists phone text;
alter table organisations add column if not exists notes text;

notify pgrst, 'reload schema';
select '0011_organisation_details complete' as result;
