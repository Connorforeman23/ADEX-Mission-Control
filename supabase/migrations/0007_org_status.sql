-- ADEX Mission Control — 0007: setting organisation status with a reason (Phase 3)
--
-- The 0006 trigger records every status change, but with no reason. This gives
-- the app one way to change status AND say why, so the history reads honestly:
--   "Prospect → Active client — Won opportunity: Autumn TV"
-- Safe to re-run.

create or replace function set_organisation_status(
  p_org uuid, p_status text, p_reason text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_history_id uuid;
begin
  if p_status not in ('prospect','active_client','former_client','not_pursuing','none') then
    raise exception 'Unknown customer status: %', p_status;
  end if;

  update organisations
     set customer_status = p_status
   where id = p_org
     and customer_status is distinct from p_status;

  -- Nothing changed (already at that status) — no history, nothing to annotate.
  if not found then return; end if;

  -- The 0006 trigger has just written the history row; add the reason to it.
  if p_reason is not null then
    select id into v_history_id
      from organisation_status_history
     where organisation_id = p_org
     order by changed_at desc
     limit 1;
    update organisation_status_history set reason = p_reason where id = v_history_id;
  end if;
end;
$$;
grant execute on function set_organisation_status(uuid, text, text) to authenticated;

-- Find an organisation by name, or create it. Used when a new opportunity names
-- a company we don't hold yet, so organisations stay the master record.
create or replace function find_or_create_organisation(
  p_name text, p_sector text default null, p_owner uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'An organisation name is required';
  end if;

  select id into v_id from organisations where lower(trim(name)) = lower(trim(p_name));
  if v_id is not null then return v_id; end if;

  insert into organisations (name, sector, owner_id, customer_status)
  values (trim(p_name), p_sector, p_owner, 'prospect')
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function find_or_create_organisation(text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
select '0007_org_status complete' as result;
