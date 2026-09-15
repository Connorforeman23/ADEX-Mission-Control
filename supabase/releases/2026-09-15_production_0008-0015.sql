-- ADEX Mission Control — production cut-over, 15 Sept 2026
-- Migrations 0008 to 0015 in one file, in order. Every one is safe to
-- re-run, so if anything stops part-way, fix the cause and run the whole
-- file again. 0016 is deliberately NOT here: it runs after the merge has
-- been smoke-tested, because it drops a column the OLD code still reads —
-- keeping it until then keeps the Vercel rollback path open.
--
-- Expected final result:  '0015_client_invoice_lines complete'

-- ======================================================================
-- 0008_xero
-- ======================================================================
-- ADEX Mission Control — 0008: Xero connection storage (Package 4.1)
--
-- Holds the OAuth tokens for the single connected Xero organisation.
-- SECURITY: RLS is on with NO policies — exactly like staff_roles — so the
-- tokens are unreachable from the browser under any circumstances. The only way
-- in is through the security-definer functions below, each of which checks
-- is_admin() and fails closed.
--
-- One row only (id is fixed), because the CRM connects to one Xero org.
-- Safe to re-run.

create table if not exists xero_connection (
  id boolean primary key default true check (id),   -- forces a single row
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_by uuid references profiles (id),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz
);

alter table xero_connection enable row level security;
-- Deliberately no policies. Client access is denied outright.

-- --- read: used by the server to make Xero API calls -----------------------
create or replace function xero_get_connection()
returns table (
  tenant_id text, tenant_name text, access_token text, refresh_token text,
  expires_at timestamptz, connected_at timestamptz, last_sync_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can use the Xero connection';
  end if;
  return query
    select c.tenant_id, c.tenant_name, c.access_token, c.refresh_token,
           c.expires_at, c.connected_at, c.last_sync_at
    from xero_connection c where c.id = true;
end;
$$;
grant execute on function xero_get_connection() to authenticated;

-- --- status: safe summary for the UI, no tokens ----------------------------
create or replace function xero_status()
returns table (connected boolean, tenant_name text, connected_at timestamptz, last_sync_at timestamptz)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can view the Xero connection';
  end if;
  return query
    select true, c.tenant_name, c.connected_at, c.last_sync_at
    from xero_connection c where c.id = true;
  if not found then
    return query select false, null::text, null::timestamptz, null::timestamptz;
  end if;
end;
$$;
grant execute on function xero_status() to authenticated;

-- --- write: store or replace the connection --------------------------------
create or replace function xero_save_connection(
  p_tenant_id text, p_tenant_name text, p_access_token text,
  p_refresh_token text, p_expires_at timestamptz
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can connect Xero';
  end if;
  insert into xero_connection (id, tenant_id, tenant_name, access_token, refresh_token, expires_at, connected_by)
  values (true, p_tenant_id, p_tenant_name, p_access_token, p_refresh_token, p_expires_at, auth.uid())
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    tenant_name = excluded.tenant_name,
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at,
    connected_by = coalesce(xero_connection.connected_by, excluded.connected_by);
end;
$$;
grant execute on function xero_save_connection(text, text, text, text, timestamptz) to authenticated;

-- --- refresh: Xero rotates the refresh token on every use, so the new pair
--     MUST be stored or the connection silently dies. ------------------------
create or replace function xero_update_tokens(
  p_access_token text, p_refresh_token text, p_expires_at timestamptz
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can refresh the Xero connection';
  end if;
  update xero_connection
     set access_token = p_access_token,
         refresh_token = p_refresh_token,
         expires_at = p_expires_at
   where id = true;
end;
$$;
grant execute on function xero_update_tokens(text, text, timestamptz) to authenticated;

create or replace function xero_mark_synced()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an administrator can sync Xero'; end if;
  update xero_connection set last_sync_at = now() where id = true;
end;
$$;
grant execute on function xero_mark_synced() to authenticated;

-- --- disconnect ------------------------------------------------------------
create or replace function xero_disconnect()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can disconnect Xero';
  end if;
  delete from xero_connection where id = true;
end;
$$;
grant execute on function xero_disconnect() to authenticated;

-- Connecting/disconnecting is a security-relevant event, so it is audited — but
-- NOT with the generic audit_row(), which would copy the access and refresh
-- tokens into audit_log in plain text where any admin could read them. This
-- dedicated trigger records the event and the Xero org name only.
create or replace function audit_xero_connection()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_email, action, entity, row_id, changed, primary_label)
  values (
    auth.uid(), v_email, tg_op, 'xero_connection', null,
    jsonb_build_object(
      'tenant_name', coalesce(new.tenant_name, old.tenant_name),
      'note', 'tokens deliberately not recorded'
    ),
    coalesce(new.tenant_name, old.tenant_name)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_trg on xero_connection;
drop trigger if exists audit_xero_connection_trg on xero_connection;
create trigger audit_xero_connection_trg
  after insert or update or delete on xero_connection
  for each row execute function audit_xero_connection();

notify pgrst, 'reload schema';
select '0008_xero complete' as result;

-- ======================================================================
-- 0009_space_orders
-- ======================================================================
-- ADEX Mission Control — 0009: Space Order details
--
-- A Space Order is the document sent to a media owner to confirm a booking.
-- Two things it needs that the booking line doesn't yet carry:
--   supplier_contact — the "To:" name (column already exists from the import)
--   order_notes      — free text at the foot of the order, e.g.
--                      "Continuation of campaign / Please confirm receipt"
--
-- Deliberately NOT stored here: anything about what the client is charged.
-- The supplier must never see the client charge, so the Space Order is built
-- only from supplier_gross / supplier_net.
-- Safe to re-run.

alter table campaign_lines add column if not exists order_notes text;

notify pgrst, 'reload schema';
select '0009_space_orders complete' as result;

-- ======================================================================
-- 0010_space_order_grouping
-- ======================================================================
-- ADEX Mission Control — 0010: one Space Order per campaign + supplier
--
-- Rick's correction: a Space Order is per SUPPLIER, not per booking line.
-- ITV1 and ITVQuiz are separate lines (different rates) but the same supplier,
-- so they belong on ONE order. Sending ITV two orders for one campaign is
-- wrong. The real RAN0102 order shows the same shape — one order to FT
-- covering nine insertions.
--
-- The order number therefore belongs to the ORDER, not the line. Existing
-- numbers are preserved: each group adopts the lowest number already held by
-- its lines, so nothing that has been quoted internally changes. Any higher
-- numbers in the same group are simply not reused.
--
-- Safe to run now because no Space Order has ever been sent from this system —
-- the document itself was only built today. Consolidating later would not be.
-- Safe to re-run.

create table if not exists space_orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  supplier_org_id uuid references organisations (id),
  -- vendor text is always present; the organisation link may not be on old rows
  supplier_name text not null,
  order_number text,
  supplier_contact text,
  order_notes text,
  created_at timestamptz not null default now()
);

-- One order per supplier per campaign.
create unique index if not exists space_orders_campaign_supplier_key
  on space_orders (campaign_id, lower(trim(supplier_name)));

alter table campaign_lines add column if not exists space_order_id uuid references space_orders (id) on delete set null;
create index if not exists campaign_lines_space_order_idx on campaign_lines (space_order_id);

-- --- backfill: group existing lines by campaign + supplier -----------------
insert into space_orders (campaign_id, supplier_org_id, supplier_name, order_number, supplier_contact, order_notes)
select
  l.campaign_id,
  (array_agg(l.supplier_org_id) filter (where l.supplier_org_id is not null))[1],
  min(trim(l.vendor)),
  min(l.supplier_po),                       -- keep the earliest number already issued
  (array_agg(l.supplier_contact) filter (where l.supplier_contact is not null))[1],
  (array_agg(l.order_notes) filter (where l.order_notes is not null))[1]
from campaign_lines l
where coalesce(trim(l.vendor), '') <> ''
group by l.campaign_id, lower(trim(l.vendor))
on conflict do nothing;

update campaign_lines l
   set space_order_id = s.id
  from space_orders s
 where s.campaign_id = l.campaign_id
   and lower(trim(s.supplier_name)) = lower(trim(l.vendor))
   and l.space_order_id is null;

-- --- security: mirrors the campaign_lines model ---------------------------
alter table space_orders enable row level security;

drop policy if exists "space orders follow their campaign" on space_orders;
create policy "space orders follow their campaign" on space_orders for all to authenticated
  using (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))))
  with check (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))));

drop trigger if exists audit_trg on space_orders;
create trigger audit_trg after insert or update or delete on space_orders
  for each row execute function audit_row();

notify pgrst, 'reload schema';
select '0010_space_order_grouping complete' as result,
       (select count(*) from space_orders) as orders,
       (select count(*) from campaign_lines where space_order_id is not null) as lines_linked;

-- ======================================================================
-- 0011_organisation_details
-- ======================================================================
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

-- ======================================================================
-- 0012_campaign_ref_counter
-- ======================================================================
-- ADEX Mission Control — 0012: campaign references from a counter
--
-- Rick hit "duplicate key value violates unique constraint campaigns_ref_key"
-- on his second booking. Cause: references were derived by taking the highest
-- existing ref and adding one — but sorted as TEXT. With the seeded TST-0001..
-- TST-0005 campaigns present, "T" sorts after "A", so the highest was always
-- TST-0005, which strips to 0005, so every new campaign was offered AE-6.
-- The first booking took AE-6; the second collided.
--
-- Text sorting would break anyway at the 999→1000 boundary ("AE-999" sorts
-- above "AE-1000"), and two people booking at once could read the same maximum.
-- A counter fixes all three: it is atomic and never re-reads existing rows.
--
-- Seeded from the highest existing AE- reference so numbering continues rather
-- than restarting. Safe to re-run.

create or replace function next_campaign_ref()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
  seed integer;
begin
  -- Highest AE- reference already used; TST- and other prefixes are ignored.
  select coalesce(
           max(nullif(regexp_replace(ref, '\D', '', 'g'), '')::integer),
           2600
         )
    into seed
    from campaigns
   where ref like 'AE-%';

  insert into po_counters (prefix, last_number)
  values ('CAMPAIGN_REF', greatest(seed, 2600) + 1)
  on conflict (prefix) do update
    set last_number = po_counters.last_number + 1
  returning last_number into n;

  return 'AE-' || n;
end;
$$;
grant execute on function next_campaign_ref() to authenticated;

notify pgrst, 'reload schema';
-- Deliberately not calling next_campaign_ref() here: it consumes a number, and
-- a migration should not burn a reference just to report success.
select '0012_campaign_ref_counter complete' as result;

-- ======================================================================
-- 0013_opportunity_detail
-- ======================================================================
-- ADEX Mission Control — 0013: what an opportunity is actually offering
--
-- Deliberately light. Rick asked to discuss whether opportunities should carry
-- full campaign detail before anything is built, and leaned towards keeping the
-- pipeline headline-based. Connor needs enough to tell one offer from another
-- at a glance — press-and-email versus TV.
--
-- So: which channels are on the table, and a free-text note. Not a line-level
-- quoting engine; that decision stays open.
-- Safe to re-run.

alter table leads add column if not exists channels text[];
alter table leads add column if not exists proposal_note text;

notify pgrst, 'reload schema';
select '0013_opportunity_detail complete' as result;

-- ======================================================================
-- 0014_line_publication
-- ======================================================================
-- ADEX Mission Control — 0014: the publication a line is booked into
--
-- Comparing the two real orders shows the "Media" column is NOT the media
-- owner — it is the publication or site:
--
--   RAN0102: Company = FT,        Media = FTWM      (FT Weekend Magazine)
--   RAN0094: Company = JCDecaux,  Media = M4 Tower  (a specific site)
--
-- The app only had `vendor` (the supplier), so Space Orders were printing the
-- media owner's name in a column suppliers expect to hold their publication.
-- One media owner has many publications, and Connor needs each on its own line.
--
-- Optional: existing lines fall back to the vendor name, which is what they
-- were showing before.
-- Safe to re-run.

alter table campaign_lines add column if not exists publication text;

notify pgrst, 'reload schema';
select '0014_line_publication complete' as result;

-- ======================================================================
-- 0015_client_invoice_lines
-- ======================================================================
-- ADEX Mission Control — 0015: client invoice line items
--
-- Until now a client invoice was a single total, which is not what ADEX
-- actually sends. The three real Randox invoices show the shape:
--
--   18824  nine booking lines, each with its own "… Production" line beneath
--   18825  one line, "Mancunian Arch campaign September 2026"
--   18826  one line, "M4 Tower 07.09.26 - 04.10.26"
--
-- So: one invoice per campaign, one line per booking line, media and
-- production separate, and the description is free text the account handler
-- can rewrite. We pre-fill it from the booking line and let them edit — the
-- wording on 18825 could never have been derived from the data.
--
-- Zero-value lines are kept, not dropped: 18824 prints
-- "1 x DEP Platinum Production  0.00  0.00  0.00" because the client expects
-- to see the item even when it costs nothing.
--
-- Amounts are ex VAT, matching the Net Amount column. VAT is derived at 20%
-- the same way client_invoices does it, so the two can never disagree.
-- Safe to re-run.

create table if not exists client_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references client_invoices (id) on delete cascade,
  -- Which booking line this came from, so the invoice can be traced back to
  -- the campaign. Nullable: hand-added lines belong to no booking line, and a
  -- deleted booking line must not take an issued invoice line with it.
  campaign_line_id uuid references campaign_lines (id) on delete set null,
  description text not null default '',
  net numeric(12, 2) not null default 0,
  vat numeric(12, 2) generated always as (round(net * 0.20, 2)) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists client_invoice_lines_invoice_idx
  on client_invoice_lines (invoice_id, sort_order);

alter table client_invoice_lines enable row level security;

-- Same rule as the invoice header: commercial data is closed to restricted
-- users entirely.
drop policy if exists "client invoice lines for full staff" on client_invoice_lines;
create policy "client invoice lines for full staff" on client_invoice_lines for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

-- The client's own PO number appears at the top of the invoice as a zero-value
-- line ("PO Number 227936"). It lives on the campaign, but a campaign can be
-- re-invoiced later against a different PO, so the invoice keeps its own copy
-- of what was quoted at the time.
alter table client_invoices add column if not exists client_po text;

-- Randox 18824 is dated 31/08/2026 and due 25/09/2026 — end of month, payable
-- by the 25th of the next. Stored rather than computed so terms can differ.
alter table client_invoices add column if not exists due_date date;

notify pgrst, 'reload schema';
select '0015_client_invoice_lines complete' as result;

