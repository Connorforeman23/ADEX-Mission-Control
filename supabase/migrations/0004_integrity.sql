-- ADEX Mission Control — baseline 0004: financial integrity guardrails (1.4)
--
-- Database-level backstops so campaign and financial figures can't be stored in
-- a nonsensical state, regardless of the app, an import, or a direct edit.
-- The commercial maths (supplier_net, VAT) is already tamper-proof via generated
-- columns; this protects the raw inputs and the deletion path.
--
-- IMPORTANT: run supabase/VALIDATE_INTEGRITY.sql FIRST on any database with real
-- data — a check constraint cannot be added if existing rows violate it.
-- Safe to re-run (drops then re-adds each constraint).

-- --- non-negative money + sane ranges --------------------------------------
alter table campaign_lines drop constraint if exists ck_lines_gross_nonneg;
alter table campaign_lines add  constraint ck_lines_gross_nonneg check (supplier_gross >= 0);

alter table campaign_lines drop constraint if exists ck_lines_charge_nonneg;
alter table campaign_lines add  constraint ck_lines_charge_nonneg check (client_charge >= 0);

alter table campaign_lines drop constraint if exists ck_lines_cpt_nonneg;
alter table campaign_lines add  constraint ck_lines_cpt_nonneg check (cpt is null or cpt >= 0);

alter table campaign_lines drop constraint if exists ck_lines_commission_range;
alter table campaign_lines add  constraint ck_lines_commission_range check (commission_pct >= 0 and commission_pct <= 100);

alter table campaign_lines drop constraint if exists ck_lines_date_order;
alter table campaign_lines add  constraint ck_lines_date_order check (end_date >= start_date);

alter table campaigns drop constraint if exists ck_campaigns_money_nonneg;
alter table campaigns add  constraint ck_campaigns_money_nonneg
  check (fee >= 0 and billed >= 0 and cpl >= 0 and leads >= 0);

alter table supplier_invoices drop constraint if exists ck_supplier_inv_amount_nonneg;
alter table supplier_invoices add  constraint ck_supplier_inv_amount_nonneg check (amount >= 0);

alter table client_invoices drop constraint if exists ck_client_inv_amount_nonneg;
alter table client_invoices add  constraint ck_client_inv_amount_nonneg
  check (amount_ex_vat >= 0 and outstanding >= 0);

alter table leads drop constraint if exists ck_leads_value_nonneg;
alter table leads add  constraint ck_leads_value_nonneg check (value >= 0);

-- --- protect issued invoices from campaign deletion ------------------------
-- client_invoices cascades on campaign delete, which would silently shred an
-- issued invoice. Block the delete unless every invoice is still Draft/Cancelled.
create or replace function prevent_delete_invoiced_campaign()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from client_invoices
    where campaign_id = old.id
      and status not in ('Draft', 'Cancelled')
  ) then
    raise exception
      'This campaign has an issued client invoice and cannot be deleted. Cancel the invoice first, then delete.';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_delete_invoiced_campaign_trg on campaigns;
create trigger prevent_delete_invoiced_campaign_trg
  before delete on campaigns
  for each row execute function prevent_delete_invoiced_campaign();

select '0004_integrity complete' as result;
