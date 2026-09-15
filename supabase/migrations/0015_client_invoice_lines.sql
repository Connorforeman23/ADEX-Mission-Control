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
