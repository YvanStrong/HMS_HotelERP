-- Corporate accounts (company-level billing profile)
CREATE TABLE IF NOT EXISTS corporate_accounts (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    company_name VARCHAR(200) NOT NULL,
    billing_email VARCHAR(255),
    credit_limit NUMERIC(14, 2),
    payment_terms VARCHAR(64),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_accounts_hotel ON corporate_accounts(hotel_id);

-- Group booking billing links
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS master_reservation_id UUID;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS corporate_account_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_group_bookings_master_reservation'
    ) THEN
        ALTER TABLE group_bookings
            ADD CONSTRAINT fk_group_bookings_master_reservation
            FOREIGN KEY (master_reservation_id) REFERENCES reservations(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_group_bookings_corporate_account'
    ) THEN
        ALTER TABLE group_bookings
            ADD CONSTRAINT fk_group_bookings_corporate_account
            FOREIGN KEY (corporate_account_id) REFERENCES corporate_accounts(id);
    END IF;
END $$;

-- Normalize legacy billing preference labels to enforced enum values
UPDATE group_bookings SET billing_preference = 'MASTER_PAYS_ALL' WHERE billing_preference = 'MASTER_PAYS';

-- Track which guest stay a charge was incurred on when folio row is posted to another reservation (e.g. master folio)
ALTER TABLE room_charges ADD COLUMN IF NOT EXISTS originating_reservation_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_room_charges_originating_reservation'
    ) THEN
        ALTER TABLE room_charges
            ADD CONSTRAINT fk_room_charges_originating_reservation
            FOREIGN KEY (originating_reservation_id) REFERENCES reservations(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_room_charges_originating ON room_charges(originating_reservation_id);
