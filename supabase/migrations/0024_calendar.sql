-- ADEX Mission Control — 0024: tasks and the Outlook calendar
--
-- Rick's rule: Outlook is the master calendar.
--
--   * An untimed task stays in the CRM task list and nowhere else.
--   * A TIMED task gets an entry in that person's own Outlook calendar.
--   * Meetings booked in Outlook are reflected in the CRM.
--
-- One column on tasks records the Outlook entry we created, so giving a task
-- a time twice updates the same entry rather than filling someone's calendar
-- with duplicates — and removing the time deletes it again.
--
-- Safe to re-run.

alter table tasks add column if not exists ms_event_id text;

-- Meetings read back from a person's calendar, filed against a company the
-- same way emails are. Stored separately from `activities` because they are
-- refreshed from Outlook rather than typed once: Outlook stays the master.
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  ms_event_id text not null unique,
  subject text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  organiser_email text,
  attendees text[],
  web_link text,
  organisation_id uuid references organisations (id) on delete cascade,
  contact_id uuid references contacts (id) on delete set null,
  captured_by uuid references profiles (id) on delete set null,
  captured_at timestamptz not null default now()
);

create index if not exists meetings_org_idx on meetings (organisation_id, starts_at desc);

alter table meetings enable row level security;

-- Same rule as emails: shared history for full staff, nothing for restricted.
drop policy if exists "meetings for full staff" on meetings;
create policy "meetings for full staff" on meetings for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

notify pgrst, 'reload schema';
select '0024_calendar complete' as result;
