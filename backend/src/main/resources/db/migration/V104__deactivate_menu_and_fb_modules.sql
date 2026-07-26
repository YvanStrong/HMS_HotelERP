-- Hide Menu and F&B from selectable hotel functions / nav entitlements.
UPDATE platform_modules
SET active = false
WHERE module_key IN ('MENU', 'FB');

-- Drop category default links so applying a business category no longer enables them.
DELETE FROM platform_category_modules
WHERE module_id IN (
  SELECT id FROM platform_modules WHERE module_key IN ('MENU', 'FB')
);

-- Turn off existing hotel entitlements for these modules.
UPDATE hotel_module_entitlements
SET enabled = false,
    disabled_at = NOW()
WHERE module_id IN (
  SELECT id FROM platform_modules WHERE module_key IN ('MENU', 'FB')
);
