-- ADEX Mission Control — baseline 0003: admin team-management functions (1.2)
--
-- The staff_roles allow-list has RLS on and NO policies, so it is unreachable
-- from the browser except through security-definer functions. These give a
-- verified admin a safe way to view and manage the team without raw SQL.
-- Every function checks is_admin() first and fails closed. Safe to re-run.

-- --- admin check -----------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$ select coalesce((select role = 'admin' from profiles where id = auth.uid()), false); $$;
grant execute on function is_admin() to authenticated;

-- --- read: the staff list, with who has actually signed up -----------------
create or replace function admin_list_staff()
returns table (email text, full_name text, role text, is_sales boolean, signed_up boolean)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can view the staff list';
  end if;
  return query
    select s.email, s.full_name, s.role, s.is_sales,
           exists (select 1 from profiles p where lower(p.email) = lower(s.email))
    from staff_roles s
    order by s.full_name;
end;
$$;
grant execute on function admin_list_staff() to authenticated;

-- --- add or update a staff-list entry --------------------------------------
create or replace function admin_add_staff(
  p_email text, p_full_name text, p_role text, p_is_sales boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an administrator can manage the staff list';
  end if;
  if coalesce(trim(p_email), '') = '' or position('@' in p_email) = 0 then
    raise exception 'A valid email address is required';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'A full name is required';
  end if;
  if p_role not in ('admin', 'standard', 'restricted') then
    raise exception 'Role must be admin, standard or restricted';
  end if;

  insert into staff_roles (email, full_name, role, is_sales)
  values (lower(trim(p_email)), trim(p_full_name), p_role, coalesce(p_is_sales, false))
  on conflict (email) do update
    set full_name = excluded.full_name,
        role      = excluded.role,
        is_sales  = excluded.is_sales;

  -- If this person has already signed up, keep their live profile in step.
  update profiles
     set full_name = trim(p_full_name), role = p_role, is_sales = coalesce(p_is_sales, false)
   where lower(email) = lower(trim(p_email));
end;
$$;
grant execute on function admin_add_staff(text, text, text, boolean) to authenticated;

-- --- change only the role (convenience for the row dropdown) ---------------
create or replace function admin_set_role(p_email text, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare admin_count integer;
begin
  if not is_admin() then
    raise exception 'Only an administrator can change roles';
  end if;
  if p_role not in ('admin', 'standard', 'restricted') then
    raise exception 'Role must be admin, standard or restricted';
  end if;

  -- Never let the last administrator demote themselves out of admin access.
  if p_role <> 'admin' then
    select count(*) into admin_count from staff_roles where role = 'admin';
    if admin_count <= 1
       and exists (select 1 from staff_roles where lower(email) = lower(trim(p_email)) and role = 'admin') then
      raise exception 'Cannot remove the last administrator';
    end if;
  end if;

  update staff_roles set role = p_role where lower(email) = lower(trim(p_email));
  update profiles     set role = p_role where lower(email) = lower(trim(p_email));
end;
$$;
grant execute on function admin_set_role(text, text) to authenticated;

-- --- remove from the allow-list --------------------------------------------
-- NOTE: this only stops FUTURE sign-ups. It does NOT revoke an existing
-- login — actually disabling an active account is offboarding, package 1.5.
create or replace function admin_remove_staff(p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
declare admin_count integer;
begin
  if not is_admin() then
    raise exception 'Only an administrator can manage the staff list';
  end if;
  -- Don't strand the workspace with no admin on the allow-list.
  select count(*) into admin_count from staff_roles where role = 'admin';
  if admin_count <= 1
     and exists (select 1 from staff_roles where lower(email) = lower(trim(p_email)) and role = 'admin') then
    raise exception 'Cannot remove the last administrator';
  end if;
  delete from staff_roles where lower(email) = lower(trim(p_email));
end;
$$;
grant execute on function admin_remove_staff(text) to authenticated;

select '0003_admin complete' as result;
