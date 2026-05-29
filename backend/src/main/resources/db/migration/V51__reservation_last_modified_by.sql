-- Track the staff user responsible for the latest reservation operation shown in activity feeds.

ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES app_users(id) ON DELETE SET NULL;

-- Backfill from the most specific existing staff actor where possible.
UPDATE reservations
SET last_modified_by = COALESCE(checked_out_by, checked_in_by, booked_by_app_user_id)
WHERE last_modified_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_last_modified_by ON reservations(last_modified_by);
