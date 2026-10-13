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
