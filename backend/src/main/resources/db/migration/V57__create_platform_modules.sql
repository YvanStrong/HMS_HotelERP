CREATE TABLE IF NOT EXISTS platform_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key      VARCHAR(50)  UNIQUE NOT NULL,
  label           VARCHAR(100) NOT NULL,
  description     TEXT,
  nav_section     VARCHAR(50),
  tier            VARCHAR(20)  NOT NULL DEFAULT 'default'
                  CHECK (tier IN ('core', 'default', 'addon')),
  is_locked       BOOLEAN      NOT NULL DEFAULT false,
  is_paid_addon   BOOLEAN      NOT NULL DEFAULT false,
  price_per_month NUMERIC(10,2),
  active          BOOLEAN      NOT NULL DEFAULT true,
  sort_order      INT          DEFAULT 0
);

INSERT INTO platform_modules
  (module_key, label, description, nav_section, tier, is_locked, is_paid_addon, sort_order)
VALUES
  ('DASHBOARD',       'Dashboard',       'Main overview dashboard',          'core',           'core', true,  false, 1),
  ('REPORTS',         'Reports',         'Business reports and analytics',   'core',           'core', true,  false, 2),
  ('ACCOUNTING',      'Accounting',      'Financial accounting and ledger',  'core',           'core', true,  false, 3),
  ('INVOICES',        'Invoices',        'Invoice and billing management',   'guests_bookings','core', true,  false, 4),
  ('INVENTORY',       'Inventory',       'Stock and inventory management',   'services',       'core', true,  false, 5),
  ('STAFF',           'Staff',           'Staff management',                 'administration', 'core', true,  false, 6),
  ('AUDIT_LOGS',      'Audit Logs',      'System audit trail',               'administration', 'core', true,  false, 7),
  ('SETTINGS',        'Settings',        'Hotel settings and configuration', 'administration', 'core', true,  false, 8)
ON CONFLICT (module_key) DO NOTHING;

INSERT INTO platform_modules
  (module_key, label, description, nav_section, tier, is_locked, is_paid_addon, sort_order)
VALUES
  ('ROOMS',            'Rooms',            'Room management',               'rooms',           'default', false, false, 10),
  ('ROOM_TYPES',       'Room Types',       'Room type configuration',       'rooms',           'default', false, false, 11),
  ('ROOM_BLOCKS',      'Room Blocks',      'Block rooms for maintenance',   'rooms',           'default', false, false, 12),
  ('PMS',              'Reservations',     'Reservation management',        'guests_bookings', 'default', false, false, 13),
  ('GROUPS_EVENTS',    'Groups & Events',  'Group bookings and events',     'guests_bookings', 'default', false, false, 14),
  ('GUESTS',           'Guests',           'Guest profiles and history',    'guests_bookings', 'default', false, false, 15),
  ('GUEST_ANALYTICS',  'Guest Analytics',  'Guest behaviour analytics',     'reports',         'default', false, false, 16),
  ('HOUSEKEEPING',     'Housekeeping',     'Housekeeping task management',  'guests_bookings', 'default', false, false, 17),
  ('HK_MY_TASKS',      'My HK Tasks',      'Personal housekeeping tasks',   'guests_bookings', 'default', false, false, 18),
  ('SERVICE_REQUESTS', 'Service Requests', 'Guest service requests',        'guests_bookings', 'default', false, false, 19),
  ('FACILITIES',       'Facilities',       'Facility and amenity booking',  'services',        'default', false, false, 20),
  ('RESTAURANT_POS',   'POS',              'Point of sale system',          'services',        'default', false, false, 21),
  ('MENU',             'Menu',             'Restaurant menu management',    'services',        'default', false, false, 22),
  ('FB',               'F&B',              'Food and beverage management',  'services',        'default', false, false, 23)
ON CONFLICT (module_key) DO NOTHING;

INSERT INTO platform_modules
  (module_key, label, description, nav_section, tier, is_locked, is_paid_addon, price_per_month, sort_order)
VALUES
  ('SELF_ORDERS',      'Self Orders',      'Guest self-ordering system',     'services',        'addon', false, true,  29.99, 30),
  ('PRICING',          'Pricing',          'Dynamic pricing engine',         'services',        'addon', false, true,  49.99, 31),
  ('REVENUE_CHANNELS', 'Channels',         'OTA channel manager',            'services',        'addon', false, true,  59.99, 32),
  ('IOT_SMART_ROOM',   'IoT & Smart Room', 'Smart room IoT controls',        'administration',  'addon', false, true,  79.99, 33)
ON CONFLICT (module_key) DO NOTHING;
