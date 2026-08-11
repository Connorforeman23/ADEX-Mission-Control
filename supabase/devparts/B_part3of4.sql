-- B part 3 of 4 - run in order, in the DEV project

create policy "clients visible to owner or full staff" on clients for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

drop policy if exists "campaigns visible to owner or full staff" on campaigns;

create policy "campaigns visible to owner or full staff" on campaigns for all to authenticated
  using (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id))
  with check (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id));

drop policy if exists "campaign lines follow their campaign" on campaign_lines;

create policy "campaign lines follow their campaign" on campaign_lines for all to authenticated
  using (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))))
  with check (exists (select 1 from campaigns c where c.id = campaign_id
                 and (not is_restricted() or c.owner_id = auth.uid() or can_see_client(c.client_id))));

drop policy if exists "leads visible to owner or full staff" on leads;

create policy "leads visible to owner or full staff" on leads for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

drop policy if exists "creative visible to owner or full staff" on creative_items;

create policy "creative visible to owner or full staff" on creative_items for all to authenticated
  using (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id))
  with check (not is_restricted() or owner_id = auth.uid() or can_see_client(client_id));

drop policy if exists "contacts visible to owner or full staff" on contacts;

create policy "contacts visible to owner or full staff" on contacts for all to authenticated
  using (not is_restricted() or owner_id = auth.uid())
  with check (not is_restricted() or owner_id = auth.uid());

-- commercial tables: closed to restricted users entirely
drop policy if exists "supplier invoices for full staff" on supplier_invoices;

create policy "supplier invoices for full staff" on supplier_invoices for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

drop policy if exists "client invoices for full staff" on client_invoices;

create policy "client invoices for full staff" on client_invoices for all to authenticated
  using (not is_restricted()) with check (not is_restricted());

drop policy if exists "po counters for full staff" on po_counters;
