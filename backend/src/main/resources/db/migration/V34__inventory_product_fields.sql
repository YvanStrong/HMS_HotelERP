-- Product display, optional image, selling price, batch/expiry hints, soft deactivate
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS selling_price NUMERIC(14, 4),
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS manufacture_date DATE;

CREATE INDEX IF NOT EXISTS idx_inv_items_hotel_active ON inventory_items (hotel_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_items_expiry ON inventory_items (hotel_id, expiry_date) WHERE expiry_date IS NOT NULL;
