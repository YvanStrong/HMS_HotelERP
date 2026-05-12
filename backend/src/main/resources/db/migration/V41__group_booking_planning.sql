-- Planning fields for group / event blocks (headcount, room targets, billing intent).
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS expected_guests INTEGER;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS rooms_needed INTEGER;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS target_check_in DATE;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS target_check_out DATE;
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS event_type VARCHAR(64);
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS room_mix_summary VARCHAR(500);
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS billing_preference VARCHAR(32);
