-- ADEX Mission Control — 0021: task types, status, and the activity timeline
--
-- Package 7A, from Rick's proposal of 23 September 2026. The half of it that
-- needs no Microsoft connection: how tasks are shaped, and a record of every
-- conversation that isn't an email.
--
-- Safe to re-run.

-- --- 1. Task types ---------------------------------------------------------
-- Chase · Prep · Admin · Meeting. The old kinds map on: a creative or copy
-- deadline is Prep (preparing the thing that runs), a follow-up is a Chase.
-- `kind` stays as it is — the booking form still writes it, and it records
-- WHY a task exists where task_type records what sort of work it is.

alter table tasks add column if not exists task_type text not null default 'Chase'
  check (task_type in ('Chase', 'Prep', 'Admin', 'Meeting'));

update tasks set task_type = case kind
    when 'creative' then 'Prep'
    when 'copy-deadline' then 'Prep'
    when 'admin' then 'Admin'
    else 'Chase'
  end
 where task_type = 'Chase' and kind <> 'follow-up';

-- --- 2. Status, with Parked ------------------------------------------------
-- Open / Done / Parked. Parked is the one that earns its place: it lets a
-- prospect legitimately have no next action without appearing on the exception
-- report for ever.
--
-- `done` is kept and held in step by a trigger, so every existing query, report
-- and dashboard keeps working rather than being rewritten in one go.

alter table tasks add column if not exists status text not null default 'Open'
  check (status in ('Open', 'Done', 'Parked'));

update tasks set status = case when done then 'Done' else 'Open' end
 where status = 'Open' and done;

create or replace function sync_task_done()
returns trigger language plpgsql as $$
begin
  -- Whichever one was written, the other follows. Set both and they agree.
  if tg_op = 'INSERT' then
    new.done := (new.status = 'Done');
  elsif new.status is distinct from old.status then
    new.done := (new.status = 'Done');
  elsif new.done is distinct from old.done then
    new.status := case when new.done then 'Done' else 'Open' end;
  end if;
  return new;
end; $$;

drop trigger if exists tasks_sync_done on tasks;
create trigger tasks_sync_done before insert or update on tasks
  for each row execute function sync_task_done();

-- A task can also name the person it concerns, alongside the organisation,
-- campaign and opportunity it already carries.
alter table tasks add column if not exists contact_id uuid references contacts (id) on delete set null;

-- --- 3. Activities ---------------------------------------------------------
-- Calls, WhatsApp, texts, meetings and notes: everything that happened which
-- isn't an email. Emails will land in the same timeline when the Microsoft
-- connection arrives, which is why `source` exists now rather than later.

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('Call', 'WhatsApp', 'Text', 'Meeting', 'Note', 'Email')),
  -- 'manual' is typed by a person; 'outlook' will be captured automatically.
  source text not null default 'manual' check (source in ('manual', 'outlook')),
  happened_at timestamptz not null default now(),
  summary text not null,
  detail text,
  -- What it was about. An activity usually concerns one company, sometimes a
  -- particular person, campaign or opportunity as well.
  organisation_id uuid references organisations (id) on delete cascade,
  contact_id uuid references contacts (id) on delete set null,
  campaign_id uuid references campaigns (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  -- Set when the activity is the outcome of completing a task.
  task_id uuid references tasks (id) on delete set null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists activities_org_idx on activities (organisation_id, happened_at desc);
create index if not exists activities_contact_idx on activities (contact_id);
create index if not exists activities_campaign_idx on activities (campaign_id);

alter table activities enable row level security;

-- Shared history is the point: any full-staff user sees any organisation's
-- activity. Restricted users see only what they logged themselves.
drop policy if exists "activities for full staff or own" on activities;
create policy "activities for full staff or own" on activities for all to authenticated
  using (not is_restricted() or created_by = auth.uid())
  with check (not is_restricted() or created_by = auth.uid());

notify pgrst, 'reload schema';
select '0021_tasks_and_activities complete' as result;
