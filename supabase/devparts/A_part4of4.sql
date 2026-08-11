-- A part 4 of 4 - run in order, in the DEV project

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
