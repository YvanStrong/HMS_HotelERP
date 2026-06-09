-- Room block vs functions-only groups; event folio charges may post without a physical room.
ALTER TABLE group_bookings
    ADD COLUMN IF NOT EXISTS uses_room_block BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE room_charges
    ALTER COLUMN room_id DROP NOT NULL;
