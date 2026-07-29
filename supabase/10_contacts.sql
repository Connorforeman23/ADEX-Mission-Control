-- ADEX Mission Control — contacts for prospecting
-- People sit under an organisation; several contacts per organisation is
-- normal. A contact can point at a pipeline opportunity and, once won, the
-- client record. Safe to run more than once.

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
  status text not null default 'Prospect'
    check (status in ('Prospect', 'Engaged', 'Client', 'Lapsed')),
  owner_id uuid references profiles(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contacts_org_idx on contacts (organisation);
create index if not exists contacts_owner_idx on contacts (owner_id);

alter table contacts enable row level security;

drop policy if exists "contacts visible to owner or full staff" on contacts;
create policy "contacts visible to owner or full staff" on contacts
  for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

select 'contacts ready' as result;
