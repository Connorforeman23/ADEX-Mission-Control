-- ADEX Mission Control — 0017: website is unique; commission override noted
--
-- Rick's review, September 2026:
--
--   * A website identifies a company better than its name does — "Randox" and
--     "Randox Laboratories Ltd" are one company, and randox.com proves it.
--     Two organisations with the same site are a duplicate, so the site is
--     unique. Stored normalised (no scheme, no www, lower case) by the app,
--     and the index is case-insensitive to be safe.
--
--   * Commission can now be set per line (the GW deal at 10%). No schema
--     change: campaign_lines.commission_pct has existed since 0001 and
--     supplier_net is generated from it. The app simply lets it be edited.
--
-- Safe to re-run.

create unique index if not exists organisations_website_unique
  on organisations (lower(website))
  where website is not null and website <> '';

notify pgrst, 'reload schema';
select '0017_line_commission_website_unique complete' as result;
