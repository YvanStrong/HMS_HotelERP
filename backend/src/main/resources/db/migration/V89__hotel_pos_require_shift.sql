-- Per-hotel override for mobile POS shift requirement (NULL = use global hms.pos.require-shift default).
ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS pos_require_shift BOOLEAN;
