-- ADEX Mission Control — 0018: a task can be about any organisation
--
-- Rick: "chase Plug for the Modern Milkman proposal" is a task about a
-- SUPPLIER, but the task form only offered clients — it read the old clients
-- table. Tasks now point at an organisation, which is any company we deal
-- with. client_id stays for the tasks that already have one; new tasks set
-- organisation_id.
-- Safe to re-run.

alter table tasks add column if not exists organisation_id uuid references organisations (id) on delete set null;
create index if not exists tasks_organisation_idx on tasks (organisation_id);

-- Carry existing client links across by name, so nothing loses its "about".
update tasks t
   set organisation_id = o.id
  from clients c
  join organisations o on lower(trim(o.name)) = lower(trim(c.name))
 where t.client_id = c.id and t.organisation_id is null;

notify pgrst, 'reload schema';
select '0018_tasks_organisation complete' as result;
