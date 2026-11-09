-- ADEX Mission Control — 0027: a logo against each organisation
--
-- The proposal decks put media-owner logos along the foot of a channel slide
-- (Benson Goldstein does this under the TV slide: ITV, Sky, UKTV, GB News,
-- Axiom). Sourcing those by hand every time is exactly the work the CRM should
-- remove — it already knows which suppliers are on the campaign.
--
-- Stored on the row as a data URI rather than in a storage bucket. Three
-- reasons, in order of weight:
--
--   1. PowerPoint needs the bytes, not a URL — the generator embeds them, so a
--      bucket would mean fetching every logo back out again on every build.
--   2. They are small: normalised to 400px wide PNG, typically 10–40KB.
--   3. No bucket, no policies, no signed URLs, nothing to misconfigure.
--
-- The app resizes before saving, so a 3MB original never reaches this column.
-- Safe to re-run.

alter table organisations add column if not exists logo text;
comment on column organisations.logo is
  'Data URI of the company logo, normalised to 400px wide PNG by the app. Used on proposal decks.';

notify pgrst, 'reload schema';
select '0027_organisation_logo complete' as result;
