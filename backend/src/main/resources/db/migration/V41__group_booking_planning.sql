-- Planning fields for group / event blocks (headcount, room targets, billing intent).
--
-- Base table may be missing if an older DB applied a different script as V35 (branch merge) before V35 became
-- group_bookings.sql. Create idempotently so this migration (and later group features) always have a target table.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS group_booking_id UUID;

CREATE TABLE IF NOT EXISTS group_bookings (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    group_name VARCHAR(200) NOT NULL,
    group_code VARCHAR(50) UNIQUE,
    company_name VARCHAR(200),
    contact_person VARCHAR(128),
    contact_email VARCHAR(128),
    contact_phone VARCHAR(64),
    status VARCHAR(30) NOT NULL DEFAULT 'TENTATIVE',
    notes TEXT,
    created_at TIMESTAMP NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_res_group'
    ) THEN
        ALTER TABLE reservations
            ADD CONSTRAINT fk_res_group FOREIGN KEY (group_booking_id) REFERENCES group_bookings(id);
    END IF;
END $$;

ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS expected_guests INTEGER;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS rooms_needed INTEGER;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS target_check_in DATE;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS target_check_out DATE;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS event_type VARCHAR(64);
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS room_mix_summary VARCHAR(500);
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS billing_preference VARCHAR(32);
