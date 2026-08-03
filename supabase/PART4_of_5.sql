-- ADEX Randox import - part 4 of 5
-- Run the parts IN ORDER. Each is safe to re-run.

-- booking lines 101-125 of 157
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-06-01', date '2026-06-28', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-06-29', date '2026-07-26', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-07-27', date '2026-08-23', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production', null, null, 'New Copy', 400, 0, 400
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-03-07', date '2026-03-07', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-03-21', date '2026-03-21', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-04', date '2026-04-04', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2583'), 'RAN0084', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-18', date '2026-04-18', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2584'), 'RAN0085', 'Lee Capon', 'media', 'OOH', 'JCD', 'Media Cost', date '2026-04-06', date '2026-11-02', 'New Copy', 28600, 15, 28600
  union all select (select id from campaigns where ref='AE-2584'), 'RAN0085', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production', null, null, 'New Copy', 325, 0, 325
  union all select (select id from campaigns where ref='AE-2584'), 'RAN0085', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production', null, null, 'New Copy', 325, 0, 325
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-09', date '2026-05-09', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-23', date '2026-05-23', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-06', date '2026-06-06', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2585'), 'RAN0086', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-20', date '2026-06-20', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2586'), 'RAN0087', 'Lee Capon', 'media', 'OOH', 'JCD', 'JCDecaux', date '2026-03-30', date '2026-04-12', 'New Copy', 5400, 15, 5400
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-03-28', date '2026-03-28', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-11', date '2026-04-11', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-04-25', date '2026-04-25', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-02', date '2026-05-02', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-30', date '2026-05-30', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-13', date '2026-06-13', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2587'), 'RAN0088', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-06-27', date '2026-06-27', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2588'), 'RAN0089', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-05-16', date '2026-05-16', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2589'), 'RAN0090', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', null, null, 'New Copy', 4202.4, 15, 4202.4
) v;

-- booking lines 126-150 of 157
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2589'), 'RAN0090', 'Karima Dernawi', 'production', 'OOH', 'Global OOH', 'Production on x1 48 Sheet', null, null, 'New Copy', 258, 0, 258
  union all select (select id from campaigns where ref='AE-2590'), 'RAN0091', 'Karima Dernawi', 'media', 'OOH', 'Global OOH', 'Global', date '2026-07-13', date '2026-08-23', 'New Copy', 1200, 15, 1200
  union all select (select id from campaigns where ref='AE-2590'), 'RAN0091', 'Karima Dernawi', 'production', 'OOH', 'Global OOH', 'Production on x1 48 Sheet', null, null, 'New Copy', 258, 0, 258
  union all select (select id from campaigns where ref='AE-2590'), 'RAN0092', 'Lee Capon', 'media', 'OOH', 'JCD', 'JCDecaux', date '2026-07-06', date '2026-08-16', 'New Copy', 2100, 15, 2100
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-04', date '2026-07-04', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-11', date '2026-07-11', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-18', date '2026-07-18', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-07-25', date '2026-07-25', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-01', date '2026-08-01', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-08', date '2026-08-08', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-15', date '2026-08-15', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-22', date '2026-08-22', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2591'), 'RAN0093', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-08-29', date '2026-08-29', 'New Copy', 3276, 15, 3276
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-09-07', date '2026-10-04', 'New Copy', 4600, 15, 4600
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-10-19', date '2026-11-15', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-11-30', date '2026-12-27', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-12-28', date '2027-01-24', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-01-25', date '2026-02-21', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-02-22', date '2026-04-04', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0094', 'Lee Capon', 'production', 'OOH', 'JCD', 'Production x 2', null, null, 'New Copy', 800, 0, 800
  union all select (select id from campaigns where ref='AE-2592'), 'RAN0097', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', null, null, 'New Copy', 400, 15, 400
  union all select (select id from campaigns where ref='AE-2593'), 'RAN0095', 'Patsy Ramsay', 'media', 'Print', 'MMM', 'Daily Telegraph', date '2026-07-01', date '2026-07-01', 'New Copy', 12000, 15, 12000
  union all select (select id from campaigns where ref='AE-2594'), 'RAN0096', 'Daniel Roberts', 'media', 'Print', 'Irish Times', 'Irish Times', date '2026-07-01', date '2026-07-01', 'New Copy', 7327.38, 10, 7327.38
  union all select (select id from campaigns where ref='AE-2594'), 'RAN0098', 'Daniel Roberts', 'media', 'Print', 'Irish Times', 'Irish Times', date '2026-07-09', date '2026-07-09', 'New Copy', 7327.38, 10, 7327.38
  union all select (select id from campaigns where ref='AE-2594'), 'RAN0098', 'Daniel Roberts', 'media', 'Print', 'Irish Times', 'Irish Times', date '2026-07-16', date '2026-07-16', 'New Copy', 7327.38, 10, 7327.38
) v;
