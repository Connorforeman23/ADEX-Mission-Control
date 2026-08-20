-- ADEX Mission Control — 0006: Organisations (Phase 3.3a)
--
-- ADDITIVE and parallel-running. Creates the organisations structure alongside
-- the existing clients/leads/vendor model and backfills it. Nothing is dropped
-- and no existing column changes, so the app keeps working unchanged until the
-- app switch-over (3.3b). The old tables are retired only in a later step.
-- Safe to re-run.

-- =========================================================================
-- 1. The master company entity
-- =========================================================================
create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  owner_id uuid references profiles (id),
  -- Supplier is an independent yes/no: an org can be customer AND supplier.
  is_supplier boolean not null default false,
  -- The customer relationship is a lifecycle, not a flag.
  customer_status text not null default 'none'
    check (customer_status in ('prospect','active_client','former_client','not_pursuing','none')),
  -- Unique identifier to prevent future duplicates (required at active_client
  -- stage by app policy, not by constraint, to keep prospect entry quick).
  companies_house_no text,
  website text,
  -- Operational visibility — deliberately SEPARATE from customer_status.
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- One organisation per company name, case/whitespace insensitive.
create unique index if not exists organisations_name_key
  on organisations (lower(trim(name)));

-- =========================================================================
-- 2. Customer status changes are tracked events, not overwrites
-- =========================================================================
create table if not exists organisation_status_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references profiles (id),
  changed_at timestamptz not null default now(),
  reason text
);
create index if not exists org_status_history_idx
  on organisation_status_history (organisation_id, changed_at desc);

create or replace function record_org_status_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into organisation_status_history (organisation_id, old_status, new_status, changed_by)
    values (new.id, null, new.customer_status, auth.uid());
  elsif new.customer_status is distinct from old.customer_status then
    insert into organisation_status_history (organisation_id, old_status, new_status, changed_by)
    values (new.id, old.customer_status, new.customer_status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists record_org_status_change_trg on organisations;
create trigger record_org_status_change_trg
  after insert or update on organisations
  for each row execute function record_org_status_change();

-- =========================================================================
-- 3. Backfill from the existing model
-- =========================================================================
-- 3a. Customers (clients) — status mapping agreed 11 Aug 2026.
insert into organisations (name, sector, owner_id, customer_status)
select distinct on (lower(trim(c.name)))
       trim(c.name), c.sector, c.owner_id,
       case c.status
         when 'live' then 'active_client'
         when 'hold' then 'former_client'
         when 'plan' then 'prospect'
         else 'prospect'
       end
from clients c
where coalesce(trim(c.name), '') <> ''
  and not exists (select 1 from organisations o where lower(trim(o.name)) = lower(trim(c.name)));

-- 3b. Prospects (leads) — skipped where the company already exists as a client.
insert into organisations (name, sector, owner_id, customer_status)
select distinct on (lower(trim(l.name)))
       trim(l.name), l.sector, l.owner_id,
       case l.stage
         when 'Closed Won'  then 'active_client'
         when 'Closed Lost' then 'not_pursuing'
         else 'prospect'
       end
from leads l
where coalesce(trim(l.name), '') <> ''
  and not exists (select 1 from organisations o where lower(trim(o.name)) = lower(trim(l.name)));

-- 3c. Suppliers from the free-text vendor names on booking lines.
insert into organisations (name, is_supplier, customer_status)
select distinct on (lower(trim(cl.vendor))) trim(cl.vendor), true, 'none'
from campaign_lines cl
where coalesce(trim(cl.vendor), '') <> ''
  and not exists (select 1 from organisations o where lower(trim(o.name)) = lower(trim(cl.vendor)));

-- 3d. An org that is both a customer and a supplier gets the supplier flag too.
update organisations o set is_supplier = true
where o.is_supplier = false
  and exists (select 1 from campaign_lines cl where lower(trim(cl.vendor)) = lower(trim(o.name)));

-- =========================================================================
-- 4. Explicit relationship links (nullable during the parallel run)
--    Deliberately named for their business meaning, never a generic org_id.
-- =========================================================================
alter table contacts        add column if not exists organisation_id uuid references organisations (id);
alter table campaigns       add column if not exists client_org_id   uuid references organisations (id);
alter table client_invoices add column if not exists client_org_id   uuid references organisations (id);
alter table creative_items  add column if not exists client_org_id   uuid references organisations (id);
alter table campaign_lines  add column if not exists supplier_org_id uuid references organisations (id);
alter table leads           add column if not exists organisation_id uuid references organisations (id);

create index if not exists contacts_org_id_idx        on contacts (organisation_id);
create index if not exists campaigns_client_org_idx   on campaigns (client_org_id);
create index if not exists lines_supplier_org_idx     on campaign_lines (supplier_org_id);

-- Backfill each link by matching the old record's company name.
update campaigns c set client_org_id = o.id
  from clients cl, organisations o
 where c.client_id = cl.id and lower(trim(o.name)) = lower(trim(cl.name))
   and c.client_org_id is null;

update client_invoices ci set client_org_id = o.id
  from clients cl, organisations o
 where ci.client_id = cl.id and lower(trim(o.name)) = lower(trim(cl.name))
   and ci.client_org_id is null;

update creative_items cr set client_org_id = o.id
  from clients cl, organisations o
 where cr.client_id = cl.id and lower(trim(o.name)) = lower(trim(cl.name))
   and cr.client_org_id is null;

update campaign_lines cl set supplier_org_id = o.id
  from organisations o
 where lower(trim(o.name)) = lower(trim(cl.vendor)) and cl.supplier_org_id is null;

update leads l set organisation_id = o.id
  from organisations o
 where lower(trim(o.name)) = lower(trim(l.name)) and l.organisation_id is null;

-- Contacts: prefer the free-text organisation name, then fall back to their
-- client/lead link where the text didn't match anything.
update contacts ct set organisation_id = o.id
  from organisations o
 where ct.organisation_id is null and lower(trim(o.name)) = lower(trim(ct.organisation));

update contacts ct set organisation_id = o.id
  from clients cl, organisations o
 where ct.organisation_id is null and ct.client_id = cl.id
   and lower(trim(o.name)) = lower(trim(cl.name));

update contacts ct set organisation_id = o.id
  from leads l, organisations o
 where ct.organisation_id is null and ct.lead_id = l.id
   and lower(trim(o.name)) = lower(trim(l.name));

-- =========================================================================
-- 5. Carry the security controls onto the new tables (1.3 / 1.5)
-- =========================================================================
alter table organisations              enable row level security;
alter table organisation_status_history enable row level security;

-- Mirrors the 1.3 access model: restricted users see only what they own.
drop policy if exists "orgs visible to owner or full staff" on organisations;
create policy "orgs visible to owner or full staff" on organisations for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

-- History follows its organisation; written by the trigger only.
drop policy if exists "org status history follows org" on organisation_status_history;
create policy "org status history follows org" on organisation_status_history for select to authenticated
  using (exists (select 1 from organisations o
                 where o.id = organisation_id
                   and (not is_restricted() or o.owner_id = auth.uid())));

-- The organisation equivalent of can_see_client(), for use in 3.3b policies.
create or replace function can_see_org(p_org uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select not is_restricted()
      or exists (select 1 from organisations o where o.id = p_org and o.owner_id = auth.uid());
$$;
grant execute on function can_see_org(uuid) to authenticated;

-- 1.5 audit trail extends to organisations.
drop trigger if exists audit_trg on organisations;
create trigger audit_trg after insert or update or delete on organisations
  for each row execute function audit_row();

notify pgrst, 'reload schema';
select '0006_organisations complete' as result;
