-- ADEX Mission Control — foundation schema
-- Run in the Supabase SQL editor once, in order: 01_schema.sql then 02_staff.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Staff directory (keyed by email, filled in before invites go out) and the
-- profile row Supabase auth creates on first sign-in reads its name/role from it.
-- ---------------------------------------------------------------------------
create table if not exists staff_roles (
  email text primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'standard')),
  is_sales boolean not null default false
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'standard' check (role in ('admin', 'standard')),
  is_sales boolean not null default false,
  created_at timestamptz not null default now()
);

-- On sign-up, look up the staff_roles row for this email and seed the profile.
-- Anyone invited whose email isn't in staff_roles yet still gets an account,
-- just with the safe defaults (standard, not sales) until the row is added.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  match staff_roles%rowtype;
begin
  select * into match from staff_roles where lower(email) = lower(new.email);
  insert into profiles (id, email, full_name, role, is_sales)
  values (
    new.id,
    new.email,
    coalesce(match.full_name, split_part(new.email, '@', 1)),
    coalesce(match.role, 'standard'),
    coalesce(match.is_sales, false)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Campaigns + booking lines
-- ---------------------------------------------------------------------------
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
  created_at timestamptz not null default now()
);

create table if not exists campaign_lines (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  channel text not null check (channel in ('Digital', 'TV', 'Radio', 'OOH', 'Print', 'Creative')),
  vendor text not null,
  detail text,
  start_date date not null,
  end_date date not null,
  selected_dates text,
  cpt numeric(10, 2),                          -- Digital / TV / Radio only
  ooh_format text                              -- OOH only
    check (ooh_format is null or ooh_format in ('4 Sheet','6 Sheet','12 Sheet','48 Sheet','96 Sheet','Hero Site')),
  ooh_disp_type text check (ooh_disp_type is null or ooh_disp_type in ('Digital', 'Static')),
  copy_instruction text not null default 'New Copy' check (copy_instruction in ('New Copy', 'Repeat Copy', 'URN')),
  urn text,
  supplier_gross numeric(12, 2) not null default 0,
  -- Net = gross less 15%, except Creative which is time-based and billed at cost.
  supplier_net numeric(12, 2) generated always as (
    case when channel = 'Creative' then supplier_gross else round(supplier_gross * 0.85, 2) end
  ) stored,
  client_charge numeric(12, 2) not null default 0,   -- what the client is invoiced for this line (ex VAT)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Supplier invoices — PO ↔ invoice matching. One row per campaign_line once
-- the supplier bills it; variance = amount - campaign_lines.supplier_net.
-- ---------------------------------------------------------------------------
create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  campaign_line_id uuid not null references campaign_lines (id) on delete cascade unique,
  invoice_no text not null,
  invoice_date date not null default current_date,
  amount numeric(12, 2) not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pipeline (leads)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Creative production queue
-- ---------------------------------------------------------------------------
create table if not exists creative_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id),
  item text not null,
  format text,
  spec text,
  due_date date,
  stage text not null default 'Briefed'
    check (stage in ('Briefed', 'In design', 'Client approval', 'Amends', 'Approved')),
  owner_id uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS — single-tenant agency tool: any signed-in user may read/write.
-- Money-sensitive fields (charge/gross/net) are hidden per-role in the app
-- query layer, same convention as SpiraX Sentinel — RLS here is just
-- "must be logged in", not per-column.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table clients enable row level security;
alter table campaigns enable row level security;
alter table campaign_lines enable row level security;
alter table supplier_invoices enable row level security;
alter table leads enable row level security;
alter table creative_items enable row level security;

create policy "authenticated read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "self update profile" on profiles for update using (auth.uid() = id);

create policy "authenticated all clients" on clients for all using (auth.role() = 'authenticated');
create policy "authenticated all campaigns" on campaigns for all using (auth.role() = 'authenticated');
create policy "authenticated all campaign_lines" on campaign_lines for all using (auth.role() = 'authenticated');
create policy "authenticated all supplier_invoices" on supplier_invoices for all using (auth.role() = 'authenticated');
create policy "authenticated all leads" on leads for all using (auth.role() = 'authenticated');
create policy "authenticated all creative_items" on creative_items for all using (auth.role() = 'authenticated');
