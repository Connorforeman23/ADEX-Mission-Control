-- ADEX Mission Control — 0014: the publication a line is booked into
--
-- Comparing the two real orders shows the "Media" column is NOT the media
-- owner — it is the publication or site:
--
--   RAN0102: Company = FT,        Media = FTWM      (FT Weekend Magazine)
--   RAN0094: Company = JCDecaux,  Media = M4 Tower  (a specific site)
--
-- The app only had `vendor` (the supplier), so Space Orders were printing the
-- media owner's name in a column suppliers expect to hold their publication.
-- One media owner has many publications, and Connor needs each on its own line.
--
-- Optional: existing lines fall back to the vendor name, which is what they
-- were showing before.
-- Safe to re-run.

alter table campaign_lines add column if not exists publication text;

notify pgrst, 'reload schema';
select '0014_line_publication complete' as result;
