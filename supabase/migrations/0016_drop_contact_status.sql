-- ADEX Mission Control — 0016: contacts no longer carry their own status
--
-- Rick's review: a contact had a status (Prospect / Engaged / Client / Lapsed)
-- alongside the organisation's customer status, and the two could disagree.
-- A person is a prospect because their company is. The column dates from when
-- a company could be created through the contact form; that path is closed
-- now (organisation first, then contact), so the status goes with it.
--
-- Nothing is lost that matters: the organisation's customer_status and its
-- history (0007) carry the lifecycle, and contacts.client_id still records who
-- became a client contact through a won deal.
-- Safe to re-run.

alter table contacts drop column if exists status;

notify pgrst, 'reload schema';
select '0016_drop_contact_status complete' as result;
