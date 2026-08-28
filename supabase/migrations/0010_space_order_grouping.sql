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
