ALTER TABLE hotels ADD COLUMN IF NOT EXISTS early_checkin_fee NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS late_checkout_fee NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS no_show_default_fee NUMERIC(12, 2) DEFAULT 50;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_booking_id UUID REFERENCES reservations(id);

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES app_users(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_out_by UUID REFERENCES app_users(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_early_checkin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_late_checkout BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS early_checkin_fee_applied NUMERIC(12, 2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS late_checkout_fee_applied NUMERIC(12, 2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_id_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_id_verified_by UUID REFERENCES app_users(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS folio_status VARCHAR(20) NOT NULL DEFAULT 'CLOSED';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS folio_closed_at TIMESTAMPTZ;

COMMENT ON COLUMN reservations.early_checkin_fee_applied IS 'Fee posted at check-in when early stay';
COMMENT ON COLUMN reservations.late_checkout_fee_applied IS 'Fee posted at check-out when late';
