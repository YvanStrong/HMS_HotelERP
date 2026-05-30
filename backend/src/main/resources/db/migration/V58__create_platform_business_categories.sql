CREATE TABLE IF NOT EXISTS platform_business_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)  UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_category_modules (
  category_id UUID REFERENCES platform_business_categories(id) ON DELETE CASCADE,
  module_id   UUID REFERENCES platform_modules(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, module_id)
);

INSERT INTO platform_business_categories (code, name, description, icon) VALUES
  ('FULL_HOTEL',          'Full Hotel',          'Complete hotel with all features',       'building-2'),
  ('RESTAURANT_ONLY',     'Restaurant Only',     'Food and beverage business only',        'utensils'),
  ('ROOMS_ONLY',          'Rooms Only',          'Accommodation without restaurant',       'bed'),
  ('EVENTS_GROUPS',       'Events & Groups',     'Event venue and group bookings',         'calendar'),
  ('SERVICED_APARTMENTS', 'Serviced Apartments', 'Long-stay serviced apartment complex',   'home')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id FROM platform_business_categories c, platform_modules m
WHERE c.code = 'FULL_HOTEL' AND m.tier = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id FROM platform_business_categories c, platform_modules m
WHERE c.code = 'RESTAURANT_ONLY'
AND m.module_key IN ('RESTAURANT_POS','MENU','FB','GUESTS','FACILITIES')
ON CONFLICT DO NOTHING;

INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id FROM platform_business_categories c, platform_modules m
WHERE c.code = 'ROOMS_ONLY'
AND m.module_key IN ('ROOMS','ROOM_TYPES','ROOM_BLOCKS','PMS','GUESTS',
                     'GUEST_ANALYTICS','HOUSEKEEPING','HK_MY_TASKS','SERVICE_REQUESTS')
ON CONFLICT DO NOTHING;

INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id FROM platform_business_categories c, platform_modules m
WHERE c.code = 'EVENTS_GROUPS'
AND m.module_key IN ('PMS','GROUPS_EVENTS','FACILITIES','GUESTS','SERVICE_REQUESTS')
ON CONFLICT DO NOTHING;

INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id FROM platform_business_categories c, platform_modules m
WHERE c.code = 'SERVICED_APARTMENTS'
AND m.module_key IN ('ROOMS','ROOM_TYPES','PMS','GUESTS','HOUSEKEEPING',
                     'HK_MY_TASKS','SERVICE_REQUESTS')
ON CONFLICT DO NOTHING;
