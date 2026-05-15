-- Primary room type planned for a group block (used when reserving rooms later).
ALTER TABLE group_bookings ADD COLUMN IF NOT EXISTS preferred_room_type_id UUID;

ALTER TABLE group_bookings
    DROP CONSTRAINT IF EXISTS fk_group_preferred_room_type;

ALTER TABLE group_bookings
    ADD CONSTRAINT fk_group_preferred_room_type
    FOREIGN KEY (preferred_room_type_id) REFERENCES room_types (id) ON DELETE SET NULL;
