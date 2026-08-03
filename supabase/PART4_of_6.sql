-- ADEX Randox import - part 4 of 6
-- Run the parts IN ORDER. Each is safe to re-run.

-- booking lines 51-75 of 157
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-07-13', date '2026-07-26', 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-07-13', date '2026-07-26', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-07-13', date '2026-07-26', 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-07-13', date '2026-07-26', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-07-13', date '2026-07-26', 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-07-13', date '2026-07-26', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-08-10', date '2026-08-23', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-08-10', date '2026-08-23', 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-08-10', date '2026-08-23', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-08-10', date '2026-08-23', 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-09-07', date '2026-09-20', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-09-07', date '2026-09-20', 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-09-07', date '2026-09-20', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-09-07', date '2026-09-20', 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-09-07', date '2026-09-20', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-09-07', date '2026-09-20', 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-09-07', date '2026-09-20', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-09-07', date '2026-09-20', 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-09-07', date '2026-09-20', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-09-07', date '2026-09-20', 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-09-07', date '2026-09-20', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-10-05', date '2026-10-18', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-10-05', date '2026-10-18', 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-10-05', date '2026-10-18', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-10-05', date '2026-10-18', 'New Copy', 2615, 0, 2615
) v;

-- booking lines 76-100 of 157
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-11-30', date '2026-12-13', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-11-30', date '2026-12-13', 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-11-30', date '2026-12-13', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', date '2026-11-30', date '2026-12-13', 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-02-09', date '2026-02-22', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', date '2026-02-09', date '2026-02-22', 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-04-06', date '2026-04-19', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', date '2026-04-06', date '2026-04-19', 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-06-01', date '2026-06-14', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', date '2026-06-01', date '2026-06-14', 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-08-10', date '2026-08-23', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', date '2026-08-10', date '2026-08-23', 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-10-05', date '2026-10-18', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', date '2026-10-05', date '2026-10-18', 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'media', 'OOH', 'KBH Media', '2,000 x Train Card Panels', date '2026-11-30', date '2026-12-13', 'New Copy', 8000, 15, 8000
  union all select (select id from campaigns where ref='AE-2579'), 'RAN0079', 'Owen Frost', 'production', 'OOH', 'KBH Media', 'Production', date '2026-11-30', date '2026-12-13', 'New Copy', 4000, 0, 4000
  union all select (select id from campaigns where ref='AE-2580'), 'RAN0080', 'Karima Dernawi', 'media', 'Radio', 'Global OOH', 'Capital UK & Heart 80''s', date '2025-11-03', date '2025-11-30', 'New Copy', 20138, 15, 20138
  union all select (select id from campaigns where ref='AE-2580'), 'RAN0081', 'Dan Hearn', 'production', 'Creative', 'Treacle7', 'Production of Radio ad', date '2025-10-30', date '2025-11-30', 'New Copy', 1100, 0, 1100
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-01-10', date '2026-01-10', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-01-17', date '2026-01-17', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-02-07', date '2026-02-07', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2581'), 'RAN0082', 'Julia Woolley', 'media', 'OOH', '', 'FTWM', date '2026-02-14', date '2026-02-14', 'New Copy', 3120, 15, 3120
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-03-09', date '2026-04-05', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-04-06', date '2026-05-03', 'New Copy', 5000, 15, 5000
  union all select (select id from campaigns where ref='AE-2582'), 'RAN0083', 'Lee Capon', 'media', 'OOH', 'JCD', 'M4 Tower', date '2026-05-04', date '2026-05-31', 'New Copy', 5000, 15, 5000
) v;
