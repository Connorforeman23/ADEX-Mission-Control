-- ADEX Randox import - part 2 of 5
-- Run the parts IN ORDER. Each is safe to re-run.

-- booking lines 1-25 of 157
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2025-12-29', date '2026-01-11', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2025-12-29', date '2026-01-11', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2025-12-29', date '2026-01-11', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2025-12-29', date '2026-01-11', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2025-12-29', date '2026-01-11', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2025-12-29', date '2026-01-11', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-02-09', date '2026-02-22', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-02-09', date '2026-02-22', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-03-09', date '2026-03-22', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-03-09', date '2026-03-22', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-03-09', date '2026-03-22', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-03-09', date '2026-03-22', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-03-09', date '2026-03-22', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
) v;

-- booking lines 26-50 of 157
insert into campaign_lines (campaign_id, supplier_po, supplier_contact, line_type, channel, vendor, detail, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge)
select * from (
  select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-03-09', date '2026-03-22', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-04-06', date '2026-04-19', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-04-06', date '2026-04-19', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-05-04', date '2026-05-17', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-05-04', date '2026-05-17', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-05-04', date '2026-05-17', 'New Copy', 6090, 15, 6090
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 406, 0, 406
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '10 x 16 Sheets Premier', date '2026-05-04', date '2026-05-17', 'New Copy', 7620, 15, 7620
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 652, 0, 652
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '2,200 X TCP''s', date '2026-05-04', date '2026-05-17', 'New Copy', 19800, 15, 19800
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 4878, 0, 4878
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '1 X DEP Platinum', date '2026-05-04', date '2026-05-17', 'New Copy', 15751, 15, 15751
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-06-01', date '2026-06-14', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 16 Sheets GD', date '2026-06-01', date '2026-06-14', 'New Copy', 12200, 15, 12200
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 2615, 0, 2615
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 4 Sheets GD', date '2026-07-13', date '2026-07-26', 'New Copy', 3750, 15, 3750
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 819, 0, 819
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '50 x 12 Sheets GD', date '2026-07-13', date '2026-07-26', 'New Copy', 11250, 15, 11250
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'production', 'OOH', 'Global OOH', 'Production Charge', null, null, 'New Copy', 1979, 0, 1979
  union all select (select id from campaigns where ref='AE-2578'), 'RAN0078', 'Karima Benzema', 'media', 'OOH', 'Global OOH', '5 x 16 Sheets Platinum', date '2026-07-13', date '2026-07-26', 'New Copy', 6090, 15, 6090
) v;
