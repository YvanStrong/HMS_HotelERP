-- Per-hotel low-stock warning threshold for mobile POS menu (NULL = use global default).
ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS pos_low_stock_threshold INTEGER;
