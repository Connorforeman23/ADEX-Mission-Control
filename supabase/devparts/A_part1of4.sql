-- A part 1 of 4 - run in order, in the DEV project

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
