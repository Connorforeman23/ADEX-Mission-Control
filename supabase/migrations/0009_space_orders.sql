-- ADEX Mission Control — 0009: Space Order details
--
-- A Space Order is the document sent to a media owner to confirm a booking.
-- Two things it needs that the booking line doesn't yet carry:
--   supplier_contact — the "To:" name (column already exists from the import)
--   order_notes      — free text at the foot of the order, e.g.
--                      "Continuation of campaign / Please confirm receipt"
--
-- Deliberately NOT stored here: anything about what the client is charged.
-- The supplier must never see the client charge, so the Space Order is built
-- only from supplier_gross / supplier_net.
-- Safe to re-run.

alter table campaign_lines add column if not exists order_notes text;

notify pgrst, 'reload schema';
select '0009_space_orders complete' as result;
