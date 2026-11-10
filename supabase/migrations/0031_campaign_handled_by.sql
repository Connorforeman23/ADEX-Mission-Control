-- ADEX Mission Control — 0031: the person on a deal, apart from its owner
--
-- Connor, 10 Nov 2026: Randox is Connor's, Faster Property Solutions and Home
-- Start are Kate's, Spa Breaks is Jon's and everything else is Steve's.
-- Whoever actually raised or ran the booking is "associated with the deal",
-- not its owner.
--
-- campaigns.owner_id already means the owner. This adds the second person:
-- who handled it, as a profile id. Optional.
--
-- DELIBERATELY NOT A FOREIGN KEY. The first version of this file made it one
-- (references profiles). That gave campaigns two links to profiles, and every
-- query that asks for a campaign's profiles ( full_name ) — the Campaigns page,
-- the dashboard, reports, Space Orders — failed with "more than one
-- relationship", so those pages showed nothing. It went to production on
-- 10 Nov 2026 and was undone the same day. The importer only ever stores the
-- id of a staff member it has just looked up, so nothing is lost by not
-- enforcing it here.
--
-- No policy change: campaigns are already guarded by owner and client
-- (0002), and being the handler grants nothing extra.
-- Safe to re-run, and undoes the foreign key on any database that ran the
-- first version.

alter table campaigns add column if not exists handled_by uuid;

alter table campaigns drop constraint if exists campaigns_handled_by_fkey;

create index if not exists campaigns_handled_by_idx on campaigns (handled_by);

notify pgrst, 'reload schema';
select '0031_campaign_handled_by complete' as result;
