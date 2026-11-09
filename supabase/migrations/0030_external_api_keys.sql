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
