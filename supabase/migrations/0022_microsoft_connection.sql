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
