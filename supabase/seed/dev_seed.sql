-- ADEX Mission Control — DEVELOPMENT seed data
-- =====================================================================
-- Resets the business tables and loads a fictional dataset for testing.
-- Everything here is obviously fake ("TEST", "Acme", "Example").
--
-- SAFETY: this script refuses to run if it finds real production data
-- (a Randox client), so it cannot wipe the live database by accident.
-- Only ever run this against the DEVELOPMENT project.
-- Safe to re-run: it clears the fictional data first, then reloads it.
-- =====================================================================

do $$
begin
  if exists (select 1 from clients where name ilike '%randox%') then
    raise exception
      'PRODUCTION DATA DETECTED (a Randox client exists). Refusing to seed. This script is for the development database only.';
  end if;
end $$;

-- --- clear business data (dependency order) --------------------------------
delete from tasks;
delete from supplier_invoices;
delete from client_invoices;
delete from campaign_lines;
delete from creative_items;
delete from contacts;
delete from campaigns;
delete from leads;
delete from clients;
delete from po_counters;

-- --- staff who may sign up on dev (so the team can test) --------------------
-- Real emails so Connor/Rick can create dev accounts, plus role-test accounts.
insert into staff_roles (email, full_name, role, is_sales) values
  ('connor.foreman@advertisingexcellence.co.uk', 'Connor Foreman', 'admin',      true),
  ('rick.wadsworth@advertisingexcellence.co.uk', 'Rick Wadsworth', 'standard',   true),
  ('test.admin@example.com',                     'Test Admin',      'admin',      true),
  ('test.standard@example.com',                  'Test Standard',   'standard',   true),
  ('test.restricted@example.com',                'Test Restricted', 'restricted', true)
on conflict (email) do update set
  full_name = excluded.full_name, role = excluded.role, is_sales = excluded.is_sales;

-- --- clients ---------------------------------------------------------------
insert into clients (name, sector, status, retainer, client_since) values
  ('Acme Test Client',   'Retail',       'live', 'GBP 2,000 pcm', '2024'),
  ('Example Media Co',    'Technology',   'live', 'Project',       '2025'),
  ('Test Leisure Ltd',    'Leisure',      'plan', 'Project',       '2026'),
  ('Sample Care Group',   'Healthcare',   'hold', 'GBP 1,500 pcm', '2023');

-- --- campaigns (varied statuses) -------------------------------------------
insert into campaigns (ref, name, client_id, status, region, start_date, end_date, fee, note) values
  ('TST-0001', 'Example Summer OOH',  (select id from clients where name='Acme Test Client'), 'live',     'London',   current_date - 7,  current_date + 21, 0, 'Fictional test campaign.'),
  ('TST-0002', 'Test Radio Burst',    (select id from clients where name='Example Media Co'),  'booked',   'National', current_date + 14, current_date + 42, 500, 'Fictional test campaign.'),
  ('TST-0003', 'Sample Press Run',    (select id from clients where name='Acme Test Client'),  'done',     'National', current_date - 60, current_date - 20, 0, 'Fictional completed campaign.'),
  ('TST-0004', 'Draft Digital Plan',  (select id from clients where name='Test Leisure Ltd'),  'planning', 'Meridian', current_date + 30, current_date + 60, 0, 'Fictional planning campaign.'),
  ('TST-0005', 'At-Risk Campaign',    (select id from clients where name='Sample Care Group'), 'risk',     'National', current_date - 3,  current_date + 10, 0, 'Fictional at-risk campaign (low margin).');

-- --- booking lines (media + production, various channels) ------------------
insert into campaign_lines (campaign_id, channel, line_type, vendor, detail, supplier_po, start_date, end_date, copy_instruction, supplier_gross, commission_pct, client_charge) values
  ((select id from campaigns where ref='TST-0001'), 'OOH',   'media',      'JCD',        '6-sheet x10',            'TST0001', current_date - 7,  current_date + 21, 'New Copy',    5000, 15, 6000),
  ((select id from campaigns where ref='TST-0001'), 'OOH',   'production', 'JCD',        'Print production',       'TST0002', current_date - 7,  current_date - 7,  'New Copy',    400,  0,  600),
  ((select id from campaigns where ref='TST-0002'), 'Radio', 'media',      'Global',     'Drive-time spots',       'TST0003', current_date + 14, current_date + 42, 'New Copy',    8000, 15, 9000),
  ((select id from campaigns where ref='TST-0003'), 'Print', 'media',      'FT',         'Full page x2',           'TST0004', current_date - 60, current_date - 20, 'New Copy',    6552, 15, 7000),
  ((select id from campaigns where ref='TST-0004'), 'Digital','media',     'Meta',       'Prospecting',            'TST0005', current_date + 30, current_date + 60, 'New Copy',    3000, 15, 3400),
  ((select id from campaigns where ref='TST-0005'), 'TV',    'media',      'ITV',        'Regional spots',         'TST0006', current_date - 3,  current_date + 10, 'New Copy',    10000,15, 10200);  -- deliberately thin margin

-- --- supplier invoices: one matched, one variance --------------------------
insert into supplier_invoices (campaign_line_id, invoice_no, amount, approved)
select id, 'SUP-MATCH-01', supplier_net, false from campaign_lines where supplier_po='TST0001';       -- exact match
insert into supplier_invoices (campaign_line_id, invoice_no, amount, approved)
select id, 'SUP-VAR-01', supplier_net + 500, false from campaign_lines where supplier_po='TST0003';   -- +500 variance

-- --- client invoices: paid + unpaid ----------------------------------------
insert into client_invoices (campaign_id, client_id, invoice_no, amount_ex_vat, outstanding, status) values
  ((select id from campaigns where ref='TST-0003'), (select id from clients where name='Acme Test Client'), 'INV-TEST-001', 7000, 0,    'Paid'),
  ((select id from campaigns where ref='TST-0001'), (select id from clients where name='Acme Test Client'), 'INV-TEST-002', 6600, 6600, 'Unpaid');

-- --- pipeline (all stages) -------------------------------------------------
insert into leads (name, contact, sector, value, stage, next_action) values
  ('Prospect One Ltd',  'Jane Test',  'Retail',     15000, 'Engaged',      'Send proposal'),
  ('Prospect Two Ltd',  'John Sample','Technology',  22000, 'Proposal',     'Awaiting decision'),
  ('Won Deal Co',       'Sam Example','Leisure',     30000, 'Closed Won',   'Convert to client'),
  ('Lost Deal Co',      'Alex Demo',  'Care',        18000, 'Closed Lost',  'Went in-house');

-- --- creative queue --------------------------------------------------------
insert into creative_items (client_id, item, format, spec, due_date, stage, design_source) values
  ((select id from clients where name='Acme Test Client'), 'Test radio script', 'Audio', '30s', current_date + 3,  'Briefed',         'inhouse'),
  ((select id from clients where name='Example Media Co'),  'Test banner set',   'Digital','6 sizes', current_date + 5, 'Client approval', 'client'),
  ((select id from clients where name='Acme Test Client'),  'Test 6-sheet',      'OOH',   '1200x1800', current_date - 1, 'Amends',         'inhouse');  -- overdue

-- --- contacts --------------------------------------------------------------
insert into contacts (first_name, last_name, job_title, organisation, email, phone, status) values
  ('Jane',  'Test',    'Marketing Director', 'Prospect One Ltd', 'jane@example.com',  '01000 000001', 'Engaged'),
  ('John',  'Sample',  'CEO',                'Prospect Two Ltd', 'john@example.com',  '01000 000002', 'Prospect'),
  ('Priya', 'Example', 'Head of Brand',      'Prospect One Ltd', 'priya@example.com', '01000 000003', 'Prospect');

-- --- tasks -----------------------------------------------------------------
insert into tasks (title, notes, due_date, kind) values
  ('Chase Example Media artwork', 'Fictional follow-up task.', current_date + 2, 'creative'),
  ('Book Test Radio Burst',       'Fictional booking task.',   current_date + 5, 'follow-up'),
  ('Send Acme monthly report',    'Fictional admin task.',     current_date - 1, 'admin');  -- overdue

-- --- PO counter (so new dev bookings number sensibly) ----------------------
insert into po_counters (prefix, last_number) values ('TST', 6)
on conflict (prefix) do update set last_number = greatest(po_counters.last_number, 6);

select 'dev seed complete' as result,
       (select count(*) from clients) as clients,
       (select count(*) from campaigns) as campaigns,
       (select count(*) from campaign_lines) as lines,
       (select count(*) from leads) as leads,
       (select count(*) from tasks) as tasks;
