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
            'RECREATION',
            'EARLY_CHECKIN',
            'LATE_CHECKOUT',
            'NO_SHOW',
            'OTHER'
        )
    );
