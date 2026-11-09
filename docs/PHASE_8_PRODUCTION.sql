-- ADEX Mission Control — production release for Phase 8
-- Run this whole file in the PRODUCTION Supabase SQL editor BEFORE merging.
-- Every statement is safe to re-run, so running it twice does no harm.

-- ================= 0027_organisation_logo =================
-- ADEX Mission Control — 0027: a logo against each organisation
--
-- The proposal decks put media-owner logos along the foot of a channel slide
-- (Benson Goldstein does this under the TV slide: ITV, Sky, UKTV, GB News,
-- Axiom). Sourcing those by hand every time is exactly the work the CRM should
-- remove — it already knows which suppliers are on the campaign.
--
-- Stored on the row as a data URI rather than in a storage bucket. Three
-- reasons, in order of weight:
--
--   1. PowerPoint needs the bytes, not a URL — the generator embeds them, so a
--      bucket would mean fetching every logo back out again on every build.
--   2. They are small: normalised to 400px wide PNG, typically 10–40KB.
--   3. No bucket, no policies, no signed URLs, nothing to misconfigure.
--
-- The app resizes before saving, so a 3MB original never reaches this column.
-- Safe to re-run.

alter table organisations add column if not exists logo text;
comment on column organisations.logo is
  'Data URI of the company logo, normalised to 400px wide PNG by the app. Used on proposal decks.';

notify pgrst, 'reload schema';
select '0027_organisation_logo complete' as result;

-- ================= 0028_proposals =================
-- ADEX Mission Control — 0028: proposals
--
-- Connor's placement, and the right one: a proposal belongs to an opportunity,
-- and "has it gone out?" is a pipeline question.
--
-- Sometimes a proposal is a simple email offer; sometimes it is a deck like
-- Benson Goldstein or Affinity Water. Both are recorded the same way, because
-- the question the CRM has to answer is the same either way: what did we
-- propose, which version, when did it go, and what came of it.
--
-- WHAT IS STORED: the content, as structure, not the finished file. The deck
-- is rebuilt from it on demand. That keeps the rows small, and means an
-- improvement to the template reaches every proposal rather than only new
-- ones. The exact file a client received is in the sender's own sent mail,
-- which is the better record of what was actually sent anyway.
--
-- Safe to re-run.

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  -- The opportunity it is for. Kept when the opportunity is deleted so the
  -- history of what was proposed does not vanish with it.
  lead_id uuid references leads (id) on delete set null,
  organisation_id uuid not null references organisations (id) on delete cascade,
  title text not null,
  -- 'email' for a written offer, 'deck' for a presentation.
  kind text not null default 'deck' check (kind in ('email', 'deck')),
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent', 'Won', 'Lost', 'Superseded')),
  -- Benson Goldstein reached v7, so versions are normal, not exceptional.
  version integer not null default 1,
  /* The deck specification, or the email body. Shaped by lib/proposal-theme. */
  content jsonb not null default '{}'::jsonb,
  owner_id uuid references profiles (id),
  sent_at timestamptz,
  sent_by uuid references profiles (id),
  /* How it was marked sent: by a person, or noticed in the outbound mail. */
  sent_detected_from text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_lead_idx on proposals (lead_id);
create index if not exists proposals_org_idx on proposals (organisation_id, created_at desc);
create index if not exists proposals_status_idx on proposals (status);

alter table proposals enable row level security;

-- Connor: owners and admins. An admin sees everything; everyone else sees the
-- proposals they own. Restricted users see none.
drop policy if exists "proposals for owners and admins" on proposals;
create policy "proposals for owners and admins" on proposals for all to authenticated
  using (not is_restricted() and (is_admin() or owner_id = auth.uid() or created_by = auth.uid()))
  with check (not is_restricted() and (is_admin() or owner_id = auth.uid() or created_by = auth.uid()));

-- Keep updated_at honest without the app having to remember.
create or replace function touch_proposal()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists proposals_touch on proposals;
create trigger proposals_touch before update on proposals
  for each row execute function touch_proposal();

notify pgrst, 'reload schema';
select '0028_proposals complete' as result;

-- ================= 0029_po_numbers_never_reused =================
-- ADEX Mission Control — 0029: a PO number is never issued twice
--
-- Connor: "if we have a client that has orders in the file saved as PO number
-- ADE0006 can the system realise that it's linked to that client and then save
-- as the next numerical number from that generated PO?"
--
-- It already continued a client's sequence — but only for numbers IT had
-- issued. po_counters was the sole memory, so a client whose ADE0001-ADE0006
-- were raised in Sage would start again at ADE0001 here, and two different
-- orders would go to suppliers carrying the same number. That is the kind of
-- fault nobody notices until a supplier queries an invoice.
--
-- The counter now defers to the data: before issuing, it looks at the highest
-- number any line already carries for that prefix and starts above it,
-- whatever put it there — this CRM, an import, or a hand correction. The
-- counter is still the fast path; the scan is the safety net.
--
-- Numbers already in Sage but NOT in the CRM cannot be seen this way, so set
-- the starting point by hand, once per client, before raising their first
-- order here:
--
--   insert into po_counters (prefix, last_number) values ('ADE', 6)
--   on conflict (prefix) do update
--     set last_number = greatest(po_counters.last_number, excluded.last_number);
--
-- That says "ADE has reached 0006", and the next order issued is ADE0007.
-- greatest() means running it twice, or with too low a number, cannot wind a
-- sequence backwards.
--
-- Safe to re-run.

create or replace function next_po_number(p_prefix text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
  used integer;
  pfx text;
begin
  -- Letters only. The caller is any authenticated user and this runs as the
  -- definer, so the prefix must never reach the pattern below as given.
  pfx := upper(regexp_replace(coalesce(p_prefix, ''), '[^A-Za-z]', '', 'g'));
  if pfx = '' then
    pfx := 'ADX';
  end if;

  -- The highest number already in use for this prefix, whoever issued it.
  select coalesce(max((regexp_replace(supplier_po, '^' || pfx, ''))::integer), 0)
    into used
    from campaign_lines
   where supplier_po ~ ('^' || pfx || '[0-9]+$');

  insert into po_counters (prefix, last_number)
  values (pfx, used + 1)
  on conflict (prefix) do update
    set last_number = greatest(po_counters.last_number, used) + 1
  returning last_number into n;

  return pfx || lpad(n::text, 4, '0');
end;
$$;

grant execute on function next_po_number(text) to authenticated;

-- Bring the counters up to date with everything already on the books, so the
-- first order raised after this migration is right even without the scan.
insert into po_counters (prefix, last_number)
select upper(substring(supplier_po from '^[A-Z]+')),
       max((regexp_replace(supplier_po, '^[A-Z]+', ''))::integer)
  from campaign_lines
 where supplier_po ~ '^[A-Z]+[0-9]+$'
 group by 1
on conflict (prefix) do update
  set last_number = greatest(po_counters.last_number, excluded.last_number);

notify pgrst, 'reload schema';
select '0029_po_numbers_never_reused complete' as result;

-- ================= 0030_external_api_keys =================
-- ADEX Mission Control — 0030: read-only API keys for another system
--
-- Connor runs a second business and wants CFM Command to read Mission
-- Control — but only his own clients: "my clients are the ones I own".
--
-- A machine cannot sign in, so RLS (which works off auth.uid()) cannot be the
-- gate. The gate is this table instead: a key belongs to one person, and the
-- reading function returns only what that person owns. The caller never says
-- whose data it wants, so it cannot ask for anyone else's.
--
-- WHAT IS STORED: a SHA-256 hash of the key, never the key. A leak of this
-- table is not a leak of anybody's access, and a key that is lost is replaced
-- rather than looked up — which is the behaviour we want anyway.
--
-- Read-only by construction: there is no write path. The only function below
-- returns rows.
--
-- Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  /* What it is for, in words: "CFM Command". Shown in the list. */
  label text not null,
  /* SHA-256 of the key, hex. The key itself is shown once and never kept. */
  key_hash text not null unique,
  /* Whose data this key can read. Never supplied by the caller. */
  owner_id uuid not null references profiles (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  /* Revoking keeps the row, so the audit of what existed survives. */
  revoked_at timestamptz
);

create index if not exists api_keys_owner_idx on api_keys (owner_id);

alter table api_keys enable row level security;

-- Admins manage keys. Nobody else sees that they exist, and no policy grants
-- select to the key holder: a key is used, not read.
drop policy if exists "api keys are admin only" on api_keys;
create policy "api keys are admin only" on api_keys for all to authenticated
  using (is_admin()) with check (is_admin());

/*
 * Read the clients a key's owner owns, with their campaign totals.
 *
 * security definer because the caller is a machine with no Supabase session.
 * The key is matched by hash; a missing, revoked or unknown key returns no
 * rows rather than an error, so the function cannot be used to work out which
 * keys exist.
 */
create or replace function external_my_clients(p_key text)
returns table (
  client_id uuid,
  client_name text,
  sector text,
  status text,
  campaigns bigint,
  billings numeric,
  last_campaign date
)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_id uuid;
begin
  select id, owner_id into v_id, v_owner
    from api_keys
   where key_hash = encode(digest(coalesce(p_key, ''), 'sha256'), 'hex')
     and revoked_at is null;

  if v_owner is null then
    return;
  end if;

  update api_keys set last_used_at = now() where id = v_id;

  return query
    select c.id,
           c.name,
           c.sector,
           c.status,
           count(distinct cam.id),
           coalesce(sum(l.client_charge), 0),
           max(cam.end_date)
      from clients c
      left join campaigns cam on cam.client_id = c.id
      left join campaign_lines l on l.campaign_id = cam.id
     where c.owner_id = v_owner
     group by c.id, c.name, c.sector, c.status
     order by c.name;
end;
$$;

-- Only the application role may call it; it is never reachable from a browser
-- session, and the key is the whole of the authorisation.
revoke all on function external_my_clients(text) from public, anon, authenticated;

/* Creating a key. Admin only, and it returns the key ONCE — after this the
   database holds only the hash, so a lost key is replaced, not recovered. */
create or replace function api_key_create(p_label text, p_owner uuid)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_key text;
begin
  if not is_admin() then
    raise exception 'Only an administrator can create an API key';
  end if;

  -- 32 random bytes, hex. Prefixed so it is recognisable if it ever turns up
  -- somewhere it should not be.
  v_key := 'amc_' || encode(gen_random_bytes(32), 'hex');

  insert into api_keys (label, key_hash, owner_id, created_by)
  values (p_label, encode(digest(v_key, 'sha256'), 'hex'), p_owner, auth.uid());

  return v_key;
end;
$$;
grant execute on function api_key_create(text, uuid) to authenticated;

create or replace function api_key_revoke(p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can revoke an API key';
  end if;
  update api_keys set revoked_at = now() where id = p_id and revoked_at is null;
end;
$$;
grant execute on function api_key_revoke(uuid) to authenticated;

notify pgrst, 'reload schema';
select '0030_external_api_keys complete' as result;

