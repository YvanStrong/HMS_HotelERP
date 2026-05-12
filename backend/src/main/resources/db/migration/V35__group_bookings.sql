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
