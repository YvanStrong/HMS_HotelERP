ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS tax_category VARCHAR(1) NOT NULL DEFAULT 'B';

UPDATE inventory_items
SET tax_category = 'B'
WHERE tax_category IS NULL OR tax_category NOT IN ('A', 'B');

ALTER TABLE inventory_items
    DROP CONSTRAINT IF EXISTS chk_inventory_items_tax_category;

ALTER TABLE inventory_items
    ADD CONSTRAINT chk_inventory_items_tax_category
    CHECK (tax_category IN ('A', 'B'));
