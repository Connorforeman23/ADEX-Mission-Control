-- ADEX Mission Control — 0025: a supplier is not a prospect
--
-- Booking a campaign registers its media owners as organisations, so they can
-- carry contacts and an address. But find_or_create_organisation creates
-- everything as a 'prospect', so JCDecaux and ITV arrived looking like
-- companies we are trying to sell to — and turned up in the client dropdown
-- on the booking form.
--
-- Two parts: stop it happening, and correct the ones already wrong.
-- Safe to re-run.

-- --- 1. let the caller say what it is creating ----------------------------
create or replace function find_or_create_organisation(
  p_name text, p_sector text default null, p_owner uuid default null,
  -- 'prospect' for someone we are selling to; 'none' for a pure supplier.
  p_status text default 'prospect'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'An organisation name is required';
  end if;

  select id into v_id from organisations where lower(trim(name)) = lower(trim(p_name));
  if v_id is not null then return v_id; end if;

  insert into organisations (name, sector, owner_id, customer_status)
  values (trim(p_name), p_sector, p_owner,
          case when p_status in ('prospect', 'active_client', 'former_client', 'not_pursuing', 'none')
               then p_status else 'prospect' end)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function find_or_create_organisation(text, text, uuid, text) to authenticated;

-- --- 2. correct the ones already mislabelled ------------------------------
-- Deliberately narrow: only a supplier that has NEVER been treated as a
-- client. A company that is genuinely both keeps its customer status, and a
-- real prospect is never touched.
update organisations o
   set customer_status = 'none'
 where o.is_supplier
   and o.customer_status = 'prospect'
   and not exists (select 1 from campaigns c where c.client_org_id = o.id)
   and not exists (select 1 from client_invoices i where i.client_org_id = o.id)
   and not exists (select 1 from leads l where l.organisation_id = o.id)
   -- Never undo a status somebody set by hand: those are recorded in the
   -- history table, and only untouched ones are safe to correct.
   and not exists (select 1 from organisation_status_history h where h.organisation_id = o.id);

notify pgrst, 'reload schema';
select '0025_suppliers_are_not_prospects complete' as result;
