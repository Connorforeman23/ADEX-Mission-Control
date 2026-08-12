-- ADEX Mission Control — baseline 0005: audit trail + offboarding (1.5)
--
-- Part 1: an append-only audit_log written by database triggers, so every change
--   to the core financial/client/security tables is recorded (who, when, what).
--   Readable by admins only; written only by the trigger (no client write path).
-- Part 2: a per-user `active` flag so an admin can revoke access immediately,
--   plus admin_set_active() and an updated admin_list_staff().
-- Depends on is_admin() (0003). Safe to re-run.

-- =========================================================================
-- Part 1 — audit trail
-- =========================================================================
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_email text,
  action     text not null,   -- INSERT / UPDATE / DELETE
  entity     text not null,   -- table name
  row_id     uuid,
  changed    jsonb,           -- INSERT/DELETE: the row; UPDATE: only changed fields
  primary_label text          -- a human hint (ref / name / invoice_no) where available
);
create index if not exists audit_log_at_idx on audit_log (at desc);
create index if not exists audit_log_entity_idx on audit_log (entity, row_id);

alter table audit_log enable row level security;
drop policy if exists "audit read admins" on audit_log;
create policy "audit read admins" on audit_log for select to authenticated using (is_admin());
-- No insert/update/delete policy: only the security-definer trigger writes here.

create or replace function audit_row()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_row_id uuid;
  v_changed jsonb;
  v_new jsonb;
  v_old jsonb;
  v_label text;
begin
  if v_actor is not null then
    select email into v_email from profiles where id = v_actor;
  end if;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_row_id := (v_old->>'id')::uuid;
    v_changed := v_old;
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row_id := (v_new->>'id')::uuid;
    v_changed := v_new;
  else
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    v_row_id := (v_new->>'id')::uuid;
    select jsonb_object_agg(key, value) into v_changed
    from jsonb_each(v_new)
    where v_new->key is distinct from v_old->key
      and key <> 'created_at';
  end if;

  -- A friendly label for the row, read from the full row (not just the diff)
  -- so it's present even when the identifying field itself didn't change.
  v_label := coalesce(
    (coalesce(v_new, v_old)->>'ref'), (coalesce(v_new, v_old)->>'invoice_no'),
    (coalesce(v_new, v_old)->>'name'), (coalesce(v_new, v_old)->>'full_name'),
    (coalesce(v_new, v_old)->>'email'), (coalesce(v_new, v_old)->>'item')
  );

  insert into audit_log (actor_id, actor_email, action, entity, row_id, changed, primary_label)
  values (v_actor, v_email, tg_op, tg_table_name, v_row_id, v_changed, v_label);

  return coalesce(new, old);
end;
$$;

-- Attach to the core tables (all have an `id` column). staff_roles is keyed by
-- email, not id, so its meaningful effect is captured via the profiles audit.
drop trigger if exists audit_trg on campaigns;
create trigger audit_trg after insert or update or delete on campaigns        for each row execute function audit_row();
drop trigger if exists audit_trg on campaign_lines;
create trigger audit_trg after insert or update or delete on campaign_lines   for each row execute function audit_row();
drop trigger if exists audit_trg on clients;
create trigger audit_trg after insert or update or delete on clients          for each row execute function audit_row();
drop trigger if exists audit_trg on leads;
create trigger audit_trg after insert or update or delete on leads            for each row execute function audit_row();
drop trigger if exists audit_trg on client_invoices;
create trigger audit_trg after insert or update or delete on client_invoices  for each row execute function audit_row();
drop trigger if exists audit_trg on supplier_invoices;
create trigger audit_trg after insert or update or delete on supplier_invoices for each row execute function audit_row();
drop trigger if exists audit_trg on profiles;
create trigger audit_trg after insert or update or delete on profiles         for each row execute function audit_row();

-- =========================================================================
-- Part 2 — offboarding
-- =========================================================================
alter table profiles add column if not exists active boolean not null default true;

-- Enable/disable a user. Disabling locks them out on their next request
-- (enforced in the app middleware). Can't disable the last active admin.
create or replace function admin_set_active(p_email text, p_active boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare active_admins integer;
begin
  if not is_admin() then
    raise exception 'Only an administrator can enable or disable users';
  end if;
  if p_active = false then
    select count(*) into active_admins from profiles where role = 'admin' and active = true;
    if active_admins <= 1
       and exists (select 1 from profiles where lower(email) = lower(trim(p_email)) and role = 'admin' and active = true) then
      raise exception 'Cannot disable the last active administrator';
    end if;
  end if;
  update profiles set active = p_active where lower(email) = lower(trim(p_email));
end;
$$;
grant execute on function admin_set_active(text, boolean) to authenticated;

-- Rebuild admin_list_staff to include the active flag (return shape changed).
drop function if exists admin_list_staff();
create function admin_list_staff()
returns table (email text, full_name text, role text, is_sales boolean, signed_up boolean, active boolean)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can view the staff list';
  end if;
  return query
    select s.email, s.full_name, s.role, s.is_sales,
           exists (select 1 from profiles p where lower(p.email) = lower(s.email)) as signed_up,
           coalesce((select p.active from profiles p where lower(p.email) = lower(s.email)), true) as active
    from staff_roles s
    order by s.full_name;
end;
$$;
grant execute on function admin_list_staff() to authenticated;

select '0005_audit_offboarding complete' as result;
