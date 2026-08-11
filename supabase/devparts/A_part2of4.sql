-- A part 2 of 4 - run in order, in the DEV project

create table if not exists campaign_lines (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  channel text not null check (channel in ('Digital', 'TV', 'Radio', 'OOH', 'Print', 'Creative')),
  vendor text not null,
  detail text,
  supplier_po text,
  supplier_contact text,
  line_type text not null default 'media' check (line_type in ('media', 'production')),
  start_date date not null,
  end_date date not null,
  selected_dates text,
  cpt numeric(10, 2),
  ooh_format text
    check (ooh_format is null or ooh_format in ('4 Sheet','6 Sheet','12 Sheet','48 Sheet','96 Sheet','Hero Site')),
  ooh_disp_type text check (ooh_disp_type is null or ooh_disp_type in ('Digital', 'Static')),
  copy_instruction text not null default 'New Copy' check (copy_instruction in ('New Copy', 'Repeat Copy', 'URN')),
  urn text,
  commission_pct numeric(5, 2) not null default 15,
  supplier_gross numeric(12, 2) not null default 0,
  -- Net = gross less the line's own commission. Production lines carry 0%.
  supplier_net numeric(12, 2) generated always as (
    round(supplier_gross * (1 - commission_pct / 100.0), 2)
  ) stored,
  client_charge numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists campaign_lines_supplier_po_key
  on campaign_lines (supplier_po) where supplier_po is not null;

-- --- supplier invoices (PO reconciliation) --------------------------------
create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  campaign_line_id uuid not null references campaign_lines (id) on delete cascade unique,
  invoice_no text not null,
  invoice_date date not null default current_date,
  amount numeric(12, 2) not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- --- pipeline --------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  sector text,
  value numeric(12, 2) not null default 0,
  stage text not null default 'Engaged'
    check (stage in ('Engaged', 'Proposal', 'Closed Won', 'Closed Lost')),
  owner_id uuid references profiles (id),
  next_action text,
  created_at timestamptz not null default now()
);
