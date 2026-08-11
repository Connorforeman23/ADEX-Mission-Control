-- A part 3 of 4 - run in order, in the DEV project

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
