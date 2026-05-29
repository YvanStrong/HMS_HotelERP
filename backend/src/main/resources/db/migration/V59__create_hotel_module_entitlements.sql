ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS business_category_id UUID REFERENCES platform_business_categories(id);

CREATE TABLE IF NOT EXISTS hotel_module_entitlements (
  hotel_id        UUID    REFERENCES hotels(id) ON DELETE CASCADE,
  module_id       UUID    REFERENCES platform_modules(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  billing_status  VARCHAR(20) DEFAULT 'included'
                  CHECK (billing_status IN ('included','addon','trial','suspended')),
  addon_activated_at  TIMESTAMP,
  addon_expires_at    TIMESTAMP,
  enabled_at      TIMESTAMP DEFAULT NOW(),
  disabled_at     TIMESTAMP,
  PRIMARY KEY (hotel_id, module_id)
);

CREATE TABLE IF NOT EXISTS hotel_module_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID NOT NULL,
  module_key   VARCHAR(50) NOT NULL,
  old_enabled  BOOLEAN,
  new_enabled  BOOLEAN,
  old_billing  VARCHAR(20),
  new_billing  VARCHAR(20),
  changed_by   UUID,
  changed_at   TIMESTAMP DEFAULT NOW(),
  reason       TEXT
);

UPDATE hotels h
SET business_category_id = c.id
FROM platform_business_categories c
WHERE c.code = 'FULL_HOTEL'
AND h.business_category_id IS NULL;

INSERT INTO hotel_module_entitlements (hotel_id, module_id, enabled, billing_status)
SELECT h.id, m.id, true, 'included'
FROM hotels h, platform_modules m
WHERE m.tier IN ('default', 'addon')
ON CONFLICT DO NOTHING;
