-- Part A: Guest full profile (maps existing columns; adds missing fields)
-- Existing: first_name, last_name, email, phone, id_document_type, id_document_number,
--            loyalty_tier, loyalty_points, email_opt_in, sms_opt_in, preferred_language, preferences_json, ...

ALTER TABLE guests ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);
UPDATE guests
SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE full_name IS NULL OR btrim(full_name) = '';
UPDATE guests SET full_name = 'Guest' WHERE full_name IS NULL OR btrim(full_name) = '';
ALTER TABLE guests ALTER COLUMN full_name SET NOT NULL;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
UPDATE guests
SET national_id = COALESCE(NULLIF(btrim(id_document_number), ''), 'MIGR-' || REPLACE(id::text, '-', ''))
WHERE national_id IS NULL;
ALTER TABLE guests ALTER COLUMN national_id SET NOT NULL;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS date_of_birth DATE;
UPDATE guests SET date_of_birth = DATE '1990-01-01' WHERE date_of_birth IS NULL;
ALTER TABLE guests ALTER COLUMN date_of_birth SET NOT NULL;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

ALTER TABLE guests ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(5);

ALTER TABLE guests ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'Rwanda';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS province VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS cell VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS village VARCHAR(100);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS street_number VARCHAR(50);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS address_notes TEXT;

-- id_type: map from id_document_type (keep id_document_type for JPA until entity uses id_type only)
ALTER TABLE guests ADD COLUMN IF NOT EXISTS id_type VARCHAR(30) DEFAULT 'NATIONAL_ID';
UPDATE guests
SET id_type = CASE
    WHEN id_document_type IS NULL OR btrim(id_document_type) = '' THEN 'NATIONAL_ID'
    WHEN upper(id_document_type) LIKE '%PASSPORT%' THEN 'PASSPORT'
    WHEN upper(id_document_type) LIKE '%DRIVER%' THEN 'DRIVERS_LICENSE'
    ELSE 'NATIONAL_ID'
END
WHERE id_type IS NULL OR id_type = 'NATIONAL_ID';

ALTER TABLE guests ADD COLUMN IF NOT EXISTS id_expiry_date DATE;

UPDATE guests SET id_document_number = national_id WHERE id_document_number IS NULL OR btrim(id_document_number) = '';
ALTER TABLE guests ALTER COLUMN id_document_number SET NOT NULL;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS vip_level VARCHAR(20) DEFAULT 'NONE';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE guests SET marketing_consent = COALESCE(email_opt_in, FALSE) WHERE marketing_consent IS NOT DISTINCT FROM FALSE;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_guests_hotel_national_id ON guests (hotel_id, national_id);

-- Part E: Human-readable booking reference (separate from legacy confirmation_code)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(32);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_source VARCHAR(30) NOT NULL DEFAULT 'FRONT_DESK';

WITH numbered AS (
    SELECT
        id,
        EXTRACT(YEAR FROM created_at AT TIME ZONE 'UTC')::int AS y,
        ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM created_at AT TIME ZONE 'UTC')
            ORDER BY created_at, id
        ) AS rn
    FROM reservations
    WHERE booking_reference IS NULL OR btrim(booking_reference) = ''
)
UPDATE reservations r
SET booking_reference = 'HMS-' || n.y || '-' || LPAD(n.rn::text, 6, '0')
FROM numbered n
WHERE r.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS uk_reservations_booking_reference ON reservations (booking_reference);
