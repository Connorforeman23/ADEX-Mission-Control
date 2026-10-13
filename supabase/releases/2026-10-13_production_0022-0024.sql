-- ADEX Mission Control — production cut-over, 13 October 2026
-- Migrations 0022 to 0024 in order: the Microsoft 365 connection, captured
-- emails, and the calendar. Every one is safe to re-run, so if anything
-- stops part-way, fix the cause and run the whole file again.
--
-- RUN THIS BEFORE MERGING.
--
-- Expected final result:  '0024_calendar complete'

-- ======================================================================
-- 0022_microsoft_connection
-- ======================================================================
-- ADEX Mission Control — 0022: each person's Microsoft 365 connection
--
-- Unlike Xero, which is one connection for the whole company, this is PER
-- PERSON: everyone links their own mailbox and calendar, by their own choice,
-- and the CRM can only ever act as whoever is signed in.
--
-- The tokens are the sensitive part. Same pattern as xero_connection and
-- staff_roles: RLS on, NO policies at all, so the table is unreachable from
-- any browser. Everything goes through the security-definer functions below,
-- and each of those will only touch the caller's own row.
--
-- Safe to re-run.

create table if not exists ms_connections (
  user_id uuid primary key references profiles (id) on delete cascade,
  -- Who they signed in as, shown on the Settings panel so they can see which
  -- account is linked.
  account_email text,
  account_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  -- The scopes actually granted, which is not always what was asked for.
  scopes text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  /* How far back the first mail import reached, so a reconnect doesn't
     start again from scratch. */
  history_from date
);

alter table ms_connections enable row level security;
-- Deliberately no policies: nothing reaches this table except through the
-- functions below.

-- --- read your own connection ---------------------------------------------
create or replace function ms_my_connection()
returns table (
  connected boolean,
  account_email text,
  account_name text,
  connected_at timestamptz,
  last_sync_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  select true, c.account_email, c.account_name, c.connected_at, c.last_sync_at
    from ms_connections c
   where c.user_id = auth.uid();
end; $$;
grant execute on function ms_my_connection() to authenticated;

-- --- the tokens, for the server only --------------------------------------
-- Returns the caller's own tokens. A signed-in person can in principle call
-- this and see their own token, which is the same access they already have by
-- being signed in to Microsoft — but never anybody else's.
create or replace function ms_get_tokens()
returns table (access_token text, refresh_token text, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  select c.access_token, c.refresh_token, c.expires_at
    from ms_connections c
   where c.user_id = auth.uid();
end; $$;
grant execute on function ms_get_tokens() to authenticated;

-- --- save / refresh --------------------------------------------------------
create or replace function ms_save_connection(
  p_account_email text, p_account_name text, p_access_token text,
  p_refresh_token text, p_expires_at timestamptz, p_scopes text
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into ms_connections (user_id, account_email, account_name, access_token,
                              refresh_token, expires_at, scopes)
  values (auth.uid(), p_account_email, p_account_name, p_access_token,
          p_refresh_token, p_expires_at, p_scopes)
  on conflict (user_id) do update set
    account_email = excluded.account_email,
    account_name = excluded.account_name,
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at,
    scopes = excluded.scopes,
    connected_at = now();
end; $$;
grant execute on function ms_save_connection(text, text, text, text, timestamptz, text) to authenticated;

-- Microsoft rotates the refresh token on use, so the new pair MUST be stored
-- or the connection dies silently the next time — the same trap as Xero.
create or replace function ms_update_tokens(
  p_access_token text, p_refresh_token text, p_expires_at timestamptz
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update ms_connections
     set access_token = p_access_token,
         refresh_token = p_refresh_token,
         expires_at = p_expires_at
   where user_id = auth.uid();
end; $$;
grant execute on function ms_update_tokens(text, text, timestamptz) to authenticated;

create or replace function ms_mark_synced()
returns void language plpgsql security definer set search_path = public
as $$
begin
  update ms_connections set last_sync_at = now() where user_id = auth.uid();
end; $$;
grant execute on function ms_mark_synced() to authenticated;

-- --- disconnect ------------------------------------------------------------
-- Deletes that person's tokens immediately. Mail already filed against an
-- organisation stays: it is company history, not the individual's.
create or replace function ms_disconnect()
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from ms_connections where user_id = auth.uid();
end; $$;
grant execute on function ms_disconnect() to authenticated;

notify pgrst, 'reload schema';
select '0022_microsoft_connection complete' as result;

-- ======================================================================
-- 0023_emails
-- ======================================================================
-- ADEX Mission Control — 0023: captured emails
--
-- Emails between ADEX and a company already in the CRM, filed against that
-- company. Decisions taken 6 October 2026:
--
--   * Full message content is stored.
--   * Readable by anyone with full CRM access; hidden from restricted users.
--   * Kept two years, after which the body is dropped and the subject, date
--     and participants remain. (The clearing job is a later package; the
--     column is nullable from the start so nothing has to change then.)
--
-- Nothing internal is ever captured: a message is kept only when someone
-- outside advertisingexcellence.co.uk matches a known organisation.
--
-- Safe to re-run.

create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  -- Microsoft's own id. Unique, so a thread sitting in four colleagues'
  -- mailboxes is stored once rather than four times.
  ms_message_id text not null unique,
  -- Microsoft's thread id, for grouping a conversation together.
  conversation_id text,
  subject text,
  -- The first couple of lines, always kept — this is what the timeline shows.
  preview text,
  -- The whole message. Dropped after two years; the row stays.
  body text,
  from_name text,
  from_email text,
  to_emails text[],
  cc_emails text[],
  sent_at timestamptz not null,
  -- 'in' when it came from outside, 'out' when ADEX sent it.
  direction text not null check (direction in ('in', 'out')),
  -- Opens the real message in the reader's own Outlook.
  web_link text,
  -- What it was matched to.
  organisation_id uuid not null references organisations (id) on delete cascade,
  contact_id uuid references contacts (id) on delete set null,
  -- Whose mailbox it was read from. Used by "disconnect", and to show where a
  -- message came from when two people have the same thread.
  captured_by uuid references profiles (id) on delete set null,
  captured_at timestamptz not null default now()
);

create index if not exists emails_org_idx on emails (organisation_id, sent_at desc);
create index if not exists emails_conversation_idx on emails (conversation_id);
create index if not exists emails_contact_idx on emails (contact_id);

alter table emails enable row level security;

-- Shared history is the point: full-staff users read any company's
-- correspondence. Restricted users see none of it at all — not their own
-- either, since the commercial data they are kept away from is exactly what
-- these messages discuss.
drop policy if exists "emails for full staff" on emails;
create policy "emails for full staff" on emails for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

-- --- which domains belong to which organisation ---------------------------
-- A view rather than a stored column, so it is always current: an
-- organisation's domains are whatever its contacts' email addresses say, plus
-- its website.
--
-- Public mail providers are excluded deliberately. One contact at gmail.com
-- would otherwise match every Gmail sender in the world.
create or replace view organisation_domains as
with public_domains(d) as (
  values ('gmail.com'), ('googlemail.com'), ('hotmail.com'), ('hotmail.co.uk'),
         ('outlook.com'), ('live.co.uk'), ('live.com'), ('yahoo.com'),
         ('yahoo.co.uk'), ('icloud.com'), ('me.com'), ('aol.com'),
         ('btinternet.com'), ('sky.com'), ('msn.com'), ('protonmail.com')
)
select distinct o.id as organisation_id,
       lower(split_part(c.email, '@', 2)) as domain
  from organisations o
  join contacts c on c.organisation_id = o.id
 where c.email is not null
   and position('@' in c.email) > 0
   and lower(split_part(c.email, '@', 2)) not in (select d from public_domains)
union
select distinct o.id,
       lower(regexp_replace(regexp_replace(o.website, '^https?://', ''), '^www\.', ''))
  from organisations o
 where o.website is not null and o.website <> ''
   and lower(regexp_replace(regexp_replace(o.website, '^https?://', ''), '^www\.', ''))
       not in (select d from public_domains);

grant select on organisation_domains to authenticated;

notify pgrst, 'reload schema';
select '0023_emails complete' as result;

-- ======================================================================
-- 0024_calendar
-- ======================================================================
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

