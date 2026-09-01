-- ADEX Mission Control — 0013: what an opportunity is actually offering
--
-- Deliberately light. Rick asked to discuss whether opportunities should carry
-- full campaign detail before anything is built, and leaned towards keeping the
-- pipeline headline-based. Connor needs enough to tell one offer from another
-- at a glance — press-and-email versus TV.
--
-- So: which channels are on the table, and a free-text note. Not a line-level
-- quoting engine; that decision stays open.
-- Safe to re-run.

alter table leads add column if not exists channels text[];
alter table leads add column if not exists proposal_note text;

notify pgrst, 'reload schema';
select '0013_opportunity_detail complete' as result;
