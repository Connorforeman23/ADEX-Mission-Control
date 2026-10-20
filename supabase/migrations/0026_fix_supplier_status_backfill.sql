-- ADEX Mission Control — 0026: actually correct the mislabelled suppliers
--
-- 0025 tried to do this and did nothing. It skipped any organisation with a
-- row in organisation_status_history, meaning to protect statuses somebody had
-- set deliberately — but a trigger writes a history row the moment ANY
-- organisation is created, so every company looked hand-edited and nothing was
-- corrected.
--
-- The honest test is not "has history" but "has history beyond the one the
-- trigger wrote at creation": a deliberate change is a row with an old_status.
--
-- Safe to re-run.

update organisations o
   set customer_status = 'none'
 where o.is_supplier
   and o.customer_status = 'prospect'
   -- never been sold to
   and not exists (select 1 from campaigns c where c.client_org_id = o.id)
   and not exists (select 1 from client_invoices i where i.client_org_id = o.id)
   and not exists (select 1 from leads l where l.organisation_id = o.id)
   -- and nobody has deliberately changed its status: the creation row has no
   -- old_status, so anything WITH one was a real decision.
   and not exists (
     select 1 from organisation_status_history h
      where h.organisation_id = o.id and h.old_status is not null
   );

-- What changed, so the result is visible rather than silent.
select '0026 complete — suppliers now hidden from the client list: '
       || (select count(*)::text from organisations
            where is_supplier and customer_status = 'none') as result;
