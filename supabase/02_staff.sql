-- ADEX Mission Control — staff directory
-- Fill in real email addresses before sending invites, then run this once.
-- Whoever signs up against one of these emails gets their name + role
-- automatically via the handle_new_user() trigger in 01_schema.sql.

insert into staff_roles (email, full_name, role, is_sales) values
  ('steve.foreman@advertisingexcellence.co.uk',   'Steve Foreman',   'admin',    true),
  ('connor.foreman@advertisingexcellence.co.uk',  'Connor Foreman',  'admin',    true),
  ('jon.murphy@advertisingexcellence.co.uk',      'Jon Murphy',      'standard', true),
  ('kate.johnston@advertisingexcellence.co.uk',   'Kate Johnston',   'standard', true),
  ('rick.wadsworth@advertisingexcellence.co.uk',  'Rick Wadsworth',  'standard', true),
  ('lynsey.tester@advertisingexcellence.co.uk',   'Lynsey Tester',   'admin',    false),
  ('james.beach@advertisingexcellence.co.uk',     'James Beach',     'standard', false)
on conflict (email) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  is_sales = excluded.is_sales;
