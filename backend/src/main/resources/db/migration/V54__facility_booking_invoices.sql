ALTER TABLE facility_bookings
    ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_facility_booking_invoice_number
    ON facility_bookings(invoice_number)
    WHERE invoice_number IS NOT NULL;
