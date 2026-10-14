-- Production catch-up for HMS (Flyway was disabled; apply missing objects safely)
-- V103/V105 style columns + V107–V110

ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS applies_to VARCHAR(20) NOT NULL DEFAULT 'ROOMS';

ALTER TABLE depot_sales
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS promotion_id UUID,
    ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(3),
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS customer_tin VARCHAR(16);

ALTER TABLE pos_proformas
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS promotion_id UUID;

ALTER TABLE taxable_sale_event
    ADD COLUMN IF NOT EXISTS ebm_sdc_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ebm_mrc_no VARCHAR(64);

CREATE TABLE IF NOT EXISTS ebm_code_list (
    id          UUID PRIMARY KEY,
    hotel_id    UUID NOT NULL REFERENCES hotels(id),
    device_id   UUID REFERENCES ebm_device(id) ON DELETE SET NULL,
    category    VARCHAR(32) NOT NULL,
    code        VARCHAR(64) NOT NULL,
    name        VARCHAR(255),
    parent_code VARCHAR(64),
    raw_json    JSONB,
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ebm_code_list UNIQUE (hotel_id, category, code)
);

CREATE INDEX IF NOT EXISTS idx_ebm_code_list_hotel_cat
    ON ebm_code_list (hotel_id, category);

CREATE TABLE IF NOT EXISTS bug_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    hotel_id        UUID REFERENCES hotels(id) ON DELETE SET NULL,
    reporter_username VARCHAR(128),
    reporter_email  VARCHAR(255),
    reporter_role   VARCHAR(64),
    page_url        VARCHAR(1024),
    title           VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    severity        VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status          VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    admin_notes     TEXT,
    email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
    email_error     VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

ALTER TABLE bug_reports
    ADD COLUMN IF NOT EXISTS screenshot_data TEXT,
    ADD COLUMN IF NOT EXISTS screenshot_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS screenshot_content_type VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_hotel ON bug_reports(hotel_id);

UPDATE platform_modules
SET active = false
WHERE module_key IN ('MENU', 'FB');

DELETE FROM platform_category_modules
WHERE module_id IN (
  SELECT id FROM platform_modules WHERE module_key IN ('MENU', 'FB')
);

UPDATE hotel_module_entitlements
SET enabled = false,
    disabled_at = NOW()
WHERE module_id IN (
  SELECT id FROM platform_modules WHERE module_key IN ('MENU', 'FB')
)
AND enabled = true;

INSERT INTO hotel_module_entitlements (hotel_id, module_id, enabled, billing_status, show_when_disabled, enabled_at)
SELECT h.id, m.id, true, 'included', false, NOW()
FROM hotels h
CROSS JOIN platform_modules m
WHERE m.active = true
  AND m.is_locked = true
ON CONFLICT (hotel_id, module_id) DO NOTHING;

INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id
FROM platform_business_categories c
CROSS JOIN platform_modules m
WHERE c.code = 'FULL_HOTEL'
  AND m.active = true
ON CONFLICT DO NOTHING;

INSERT INTO platform_category_modules (category_id, module_id)
SELECT c.id, m.id
FROM platform_business_categories c
CROSS JOIN platform_modules m
WHERE c.code IN ('RESTAURANT_ONLY', 'ROOMS_ONLY', 'EVENTS_GROUPS', 'SERVICED_APARTMENTS')
  AND m.module_key IN ('DASHBOARD', 'SETTINGS')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_billing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL,
    target_tier VARCHAR(20),
    months INT,
    quoted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(8),
    payment_reference VARCHAR(120),
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_by UUID,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolve_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_billing_requests_status
    ON tenant_billing_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_billing_requests_hotel
    ON tenant_billing_requests (hotel_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS hr_duty_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    duty_date DATE NOT NULL,
    shift_code VARCHAR(32) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    department VARCHAR(120),
    location VARCHAR(120),
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    notes TEXT,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_hr_duty_shifts_status') THEN
        ALTER TABLE hr_duty_shifts
            ADD CONSTRAINT chk_hr_duty_shifts_status CHECK (
                status IN ('SCHEDULED', 'ON_DUTY', 'COMPLETED', 'ABSENT', 'CANCELLED', 'NO_SHOW')
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_hr_duty_shifts_shift') THEN
        ALTER TABLE hr_duty_shifts
            ADD CONSTRAINT chk_hr_duty_shifts_shift CHECK (
                shift_code IN ('MORNING', 'AFTERNOON', 'NIGHT', 'CUSTOM')
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_hotel_date
    ON hr_duty_shifts (hotel_id, duty_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_hotel_status
    ON hr_duty_shifts (hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_hotel_shift
    ON hr_duty_shifts (hotel_id, shift_code);
CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_user_date
    ON hr_duty_shifts (user_id, duty_date DESC);

-- Align Flyway history so future enablement does not re-run applied versions
INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success)
SELECT
  COALESCE((SELECT MAX(installed_rank) FROM flyway_schema_history), 0) + v.ord,
  v.version,
  v.description,
  'SQL',
  v.script,
  NULL,
  'manual-catchup',
  NOW(),
  0,
  TRUE
FROM (VALUES
  (1, '102', 'bug reports', 'V102__bug_reports.sql'),
  (2, '103', 'pos promotions', 'V103__pos_promotions.sql'),
  (3, '104', 'deactivate menu and fb modules', 'V104__deactivate_menu_and_fb_modules.sql'),
  (4, '105', 'pos foreign currency payment', 'V105__pos_foreign_currency_payment.sql'),
  (5, '107', 'bug report screenshot', 'V107__bug_report_screenshot.sql'),
  (6, '108', 'category driven module entitlements', 'V108__category_driven_module_entitlements.sql'),
  (7, '109', 'tenant billing requests', 'V109__tenant_billing_requests.sql'),
  (8, '110', 'hr duty shifts', 'V110__hr_duty_shifts.sql')
) AS v(ord, version, description, script)
WHERE NOT EXISTS (
  SELECT 1 FROM flyway_schema_history f WHERE f.version = v.version
);

-- V111: EBM internal data + invoice number on sale events
ALTER TABLE taxable_sale_event
    ADD COLUMN IF NOT EXISTS ebm_internal_data TEXT,
    ADD COLUMN IF NOT EXISTS ebm_invoice_no VARCHAR(64);

INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success)
SELECT
  COALESCE((SELECT MAX(installed_rank) FROM flyway_schema_history), 0) + 1,
  '111',
  'ebm sale internal invoice',
  'SQL',
  'V111__ebm_sale_internal_invoice.sql',
  NULL,
  'manual-catchup',
  NOW(),
  0,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM flyway_schema_history f WHERE f.version = '111'
);
