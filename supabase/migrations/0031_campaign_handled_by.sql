-- ADEX Mission Control — 0031: the person on a deal, apart from its owner
--
-- Connor, 10 Nov 2026: every client except Randox is Steve's, Randox is
-- Connor's, and the owner is only ever one of the two of them. Whoever
-- actually raised or ran the booking — Jon, Kate, Lynsey — is "associated
-- with the deal", not its owner.
--
-- campaigns.owner_id already means the owner. This adds the second person:
-- who handled it. Optional, and a profile, so it follows the person if their
-- name changes and goes blank (rather than blocking) if they are removed.
--
-- No policy change: campaigns are already guarded by owner and client
-- (0002), and being the handler grants nothing extra.
-- Safe to re-run.

alter table campaigns add column if not exists handled_by uuid references profiles (id) on delete set null;

create index if not exists campaigns_handled_by_idx on campaigns (handled_by);

notify pgrst, 'reload schema';
select '0031_campaign_handled_by complete' as result;
