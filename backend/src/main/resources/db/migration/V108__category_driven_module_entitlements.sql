-- Category templates drive hotel module visibility (including former "always on" core modules).
-- Preserve existing hotels by materializing locked-module entitlements that were previously implicit.

INSERT INTO hotel_module_entitlements (hotel_id, module_id, enabled, billing_status, show_when_disabled, enabled_at)
SELECT h.id, m.id, true, 'included', false, NOW()
FROM hotels h
CROSS JOIN platform_modules m
WHERE m.active = true
  AND m.is_locked = true
ON CONFLICT (hotel_id, module_id) DO NOTHING;

-- FULL_HOTEL includes every active module (core + default + addon).
INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id
FROM platform_business_categories c
CROSS JOIN platform_modules m
WHERE c.code = 'FULL_HOTEL'
  AND m.active = true
ON CONFLICT DO NOTHING;

-- Every seeded category keeps Dashboard + Settings so hotels remain usable.
INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id
FROM platform_business_categories c
CROSS JOIN platform_modules m
WHERE c.code IN ('RESTAURANT_ONLY', 'ROOMS_ONLY', 'EVENTS_GROUPS', 'SERVICED_APARTMENTS')
  AND m.module_key IN ('DASHBOARD', 'SETTINGS')
ON CONFLICT DO NOTHING;
