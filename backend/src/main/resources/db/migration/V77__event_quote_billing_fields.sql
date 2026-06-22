ALTER TABLE event_quote_line
    ADD COLUMN IF NOT EXISTS charge_reference_id VARCHAR(100);

ALTER TABLE event_quote
    ADD COLUMN IF NOT EXISTS charges_posted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS charges_reversed_at TIMESTAMP;

ALTER TABLE room_charges
    DROP CONSTRAINT IF EXISTS room_charges_charge_type_check;

ALTER TABLE room_charges
    ADD CONSTRAINT room_charges_charge_type_check
    CHECK (
        charge_type IN (
            'ROOM_NIGHT',
            'ROOM_SERVICE',
            'MINIBAR',
            'FNB',
            'LAUNDRY',
            'PARKING',
            'DAMAGE',
            'PHONE',
            'SPA',
            'BANQUET',
            'RECREATION',
            'EARLY_CHECKIN',
            'LATE_CHECKOUT',
            'NO_SHOW',
            'OTHER'
        )
    );
