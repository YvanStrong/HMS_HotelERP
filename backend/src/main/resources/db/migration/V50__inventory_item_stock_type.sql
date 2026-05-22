-- Inventory products can be stock-managed or non-stock service/prepared items.

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS stock_type VARCHAR(16) NOT NULL DEFAULT 'STOCK';

UPDATE inventory_items
SET stock_type = 'STOCK'
WHERE stock_type IS NULL OR stock_type = '';

ALTER TABLE inventory_items
    DROP CONSTRAINT IF EXISTS chk_inventory_items_stock_type;

ALTER TABLE inventory_items
    ADD CONSTRAINT chk_inventory_items_stock_type
    CHECK (stock_type IN ('STOCK', 'NON_STOCK'));
