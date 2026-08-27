-- ADEX Mission Control — 0008: Xero connection storage (Package 4.1)
--
-- Holds the OAuth tokens for the single connected Xero organisation.
-- SECURITY: RLS is on with NO policies — exactly like staff_roles — so the
-- tokens are unreachable from the browser under any circumstances. The only way
-- in is through the security-definer functions below, each of which checks
-- is_admin() and fails closed.
--
-- One row only (id is fixed), because the CRM connects to one Xero org.
-- Safe to re-run.

create table if not exists xero_connection (
  id boolean primary key default true check (id),   -- forces a single row
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_by uuid references profiles (id),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz
);

alter table xero_connection enable row level security;
-- Deliberately no policies. Client access is denied outright.

-- --- read: used by the server to make Xero API calls -----------------------
create or replace function xero_get_connection()
returns table (
  tenant_id text, tenant_name text, access_token text, refresh_token text,
  expires_at timestamptz, connected_at timestamptz, last_sync_at timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can use the Xero connection';
  end if;
  return query
    select c.tenant_id, c.tenant_name, c.access_token, c.refresh_token,
           c.expires_at, c.connected_at, c.last_sync_at
    from xero_connection c where c.id = true;
end;
$$;
grant execute on function xero_get_connection() to authenticated;

-- --- status: safe summary for the UI, no tokens ----------------------------
create or replace function xero_status()
returns table (connected boolean, tenant_name text, connected_at timestamptz, last_sync_at timestamptz)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can view the Xero connection';
  end if;
  return query
    select true, c.tenant_name, c.connected_at, c.last_sync_at
    from xero_connection c where c.id = true;
  if not found then
    return query select false, null::text, null::timestamptz, null::timestamptz;
  end if;
end;
$$;
grant execute on function xero_status() to authenticated;

-- --- write: store or replace the connection --------------------------------
create or replace function xero_save_connection(
  p_tenant_id text, p_tenant_name text, p_access_token text,
  p_refresh_token text, p_expires_at timestamptz
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can connect Xero';
  end if;
  insert into xero_connection (id, tenant_id, tenant_name, access_token, refresh_token, expires_at, connected_by)
  values (true, p_tenant_id, p_tenant_name, p_access_token, p_refresh_token, p_expires_at, auth.uid())
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    tenant_name = excluded.tenant_name,
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at,
    connected_by = coalesce(xero_connection.connected_by, excluded.connected_by);
end;
$$;
grant execute on function xero_save_connection(text, text, text, text, timestamptz) to authenticated;

-- --- refresh: Xero rotates the refresh token on every use, so the new pair
--     MUST be stored or the connection silently dies. ------------------------
create or replace function xero_update_tokens(
  p_access_token text, p_refresh_token text, p_expires_at timestamptz
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can refresh the Xero connection';
  end if;
  update xero_connection
     set access_token = p_access_token,
         refresh_token = p_refresh_token,
         expires_at = p_expires_at
   where id = true;
end;
$$;
grant execute on function xero_update_tokens(text, text, timestamptz) to authenticated;

create or replace function xero_mark_synced()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only an administrator can sync Xero'; end if;
  update xero_connection set last_sync_at = now() where id = true;
end;
$$;
grant execute on function xero_mark_synced() to authenticated;

-- --- disconnect ------------------------------------------------------------
create or replace function xero_disconnect()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can disconnect Xero';
  end if;
  delete from xero_connection where id = true;
end;
$$;
grant execute on function xero_disconnect() to authenticated;

-- Connecting/disconnecting is a security-relevant event, so it is audited — but
-- NOT with the generic audit_row(), which would copy the access and refresh
-- tokens into audit_log in plain text where any admin could read them. This
-- dedicated trigger records the event and the Xero org name only.
create or replace function audit_xero_connection()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_email, action, entity, row_id, changed, primary_label)
  values (
    auth.uid(), v_email, tg_op, 'xero_connection', null,
    jsonb_build_object(
      'tenant_name', coalesce(new.tenant_name, old.tenant_name),
      'note', 'tokens deliberately not recorded'
    ),
    coalesce(new.tenant_name, old.tenant_name)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_trg on xero_connection;
drop trigger if exists audit_xero_connection_trg on xero_connection;
create trigger audit_xero_connection_trg
  after insert or update or delete on xero_connection
  for each row execute function audit_xero_connection();

notify pgrst, 'reload schema';
select '0008_xero complete' as result;
