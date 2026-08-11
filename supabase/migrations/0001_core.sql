-- ADEX Mission Control — baseline 0001: core schema
--
-- Rebuilds the complete table structure to match production as verified on
-- 29 July 2026 (see docs/PRODUCTION_SCHEMA.md). This is the end state, not the
-- historical evolution — columns that production reached through later imports
-- (commission_pct, line_type, supplier_contact, invoice client_id/outstanding)
-- are defined here directly.
--
-- Safe to run on an empty database. Run 0002 after this.

create extension if not exists "pgcrypto";

-- --- staff directory + profiles -------------------------------------------
create table if not exists staff_roles (
  email text primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'standard', 'restricted')),
  is_sales boolean not null default false
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'standard' check (role in ('admin', 'standard', 'restricted')),
  is_sales boolean not null default false,
  created_at timestamptz not null default now()
);

-- --- clients ---------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sector text,
  owner_id uuid references profiles (id),
  retainer text,
  status text not null default 'live' check (status in ('live', 'plan', 'hold')),
  client_since text,
  review_date date,
  created_at timestamptz not null default now()
);

-- --- campaigns + booking lines --------------------------------------------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  name text not null,
  client_id uuid not null references clients (id),
  status text not null default 'planning'
    check (status in ('planning', 'booked', 'live', 'risk', 'done')),
  owner_id uuid references profiles (id),
  region text not null default 'National',
  start_date date,
  end_date date,
  fee numeric(12, 2) not null default 0,
  billed numeric(12, 2) not null default 0,
  leads int not null default 0,
  cpl numeric(10, 2) not null default 0,
  note text,
  client_po text,
  created_at timestamptz not null default now()
);

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

-- --- creative --------------------------------------------------------------
create table if not exists creative_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id),
  campaign_id uuid references campaigns (id) on delete cascade,
  item text not null,
  format text,
  spec text,
  due_date date,
  stage text not null default 'Briefed'
    check (stage in ('Briefed', 'In design', 'Client approval', 'Amends', 'Approved')),
  design_source text default 'inhouse' check (design_source in ('inhouse', 'client')),
  owner_id uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- --- contacts --------------------------------------------------------------
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  job_title text,
  organisation text not null,
  email text,
  phone text,
  mobile text,
  linkedin text,
  notes text,
  status text not null default 'Prospect' check (status in ('Prospect', 'Engaged', 'Client', 'Lapsed')),
  owner_id uuid references profiles (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contacts_org_idx on contacts (organisation);
create index if not exists contacts_owner_idx on contacts (owner_id);

-- --- PO numbering + client invoices ---------------------------------------
create table if not exists po_counters (
  prefix text primary key,
  last_number integer not null default 0
);

create table if not exists client_invoices (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns (id) on delete cascade,
  client_id uuid references clients (id) on delete cascade,
  invoice_no text unique,
  invoice_date date not null default current_date,
  amount_ex_vat numeric(12, 2) not null default 0,
  outstanding numeric(12, 2) not null default 0,
  vat numeric(12, 2) generated always as (round(amount_ex_vat * 0.20, 2)) stored,
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent', 'Paid', 'Unpaid', 'Overdue', 'Cancelled')),
  xero_id text,
  created_at timestamptz not null default now()
);

-- --- tasks -----------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  kind text not null default 'follow-up'
    check (kind in ('follow-up', 'creative', 'copy-deadline', 'admin')),
  assignee_id uuid references profiles (id) on delete set null,
  campaign_id uuid references campaigns (id) on delete cascade,
  client_id   uuid references clients (id)   on delete cascade,
  lead_id     uuid references leads (id)     on delete cascade,
  creative_id uuid references creative_items (id) on delete cascade,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists tasks_due_idx on tasks (done, due_date);
create index if not exists tasks_assignee_idx on tasks (assignee_id);

-- --- enable RLS on everything (policies live in 0002) ----------------------
alter table staff_roles       enable row level security;
alter table profiles          enable row level security;
alter table clients           enable row level security;
alter table campaigns         enable row level security;
alter table campaign_lines    enable row level security;
alter table supplier_invoices enable row level security;
alter table leads             enable row level security;
alter table creative_items    enable row level security;
alter table contacts          enable row level security;
alter table po_counters       enable row level security;
alter table client_invoices   enable row level security;
alter table tasks             enable row level security;

select '0001_core complete' as result;
