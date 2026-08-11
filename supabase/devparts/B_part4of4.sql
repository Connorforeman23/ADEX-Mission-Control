-- B part 4 of 4 - run in order, in the DEV project

create policy "po counters for full staff" on po_counters for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

drop policy if exists "tasks visible to full staff or own" on tasks;

create policy "tasks visible to full staff or own" on tasks for all to authenticated
  using (not is_restricted() or assignee_id = auth.uid())
  with check (not is_restricted() or assignee_id = auth.uid());

-- staff_roles stays RLS-on with no policy: reached only via the definer
-- functions above, so all direct client access is denied.

select '0002_functions_rls complete' as result;
