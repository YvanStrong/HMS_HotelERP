-- Allow promotions to target rooms, POS, or both
ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS applies_to VARCHAR(20) NOT NULL DEFAULT 'ROOMS';

UPDATE promotions SET applies_to = 'ROOMS' WHERE applies_to IS NULL OR applies_to = '';

-- Snapshot discount fields on completed POS sales
ALTER TABLE depot_sales
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS promotion_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_depot_sales_promotion'
    ) THEN
        ALTER TABLE depot_sales
            ADD CONSTRAINT fk_depot_sales_promotion
            FOREIGN KEY (promotion_id) REFERENCES promotions(id);
    END IF;
END $$;

UPDATE depot_sales
SET subtotal_amount = total_amount
WHERE subtotal_amount IS NULL;

ALTER TABLE pos_proformas
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS promotion_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pos_proformas_promotion'
    ) THEN
        ALTER TABLE pos_proformas
            ADD CONSTRAINT fk_pos_proformas_promotion
            FOREIGN KEY (promotion_id) REFERENCES promotions(id);
    END IF;
END $$;

UPDATE pos_proformas
SET subtotal_amount = total_amount
WHERE subtotal_amount IS NULL;

ALTER TABLE pos_delivery_orders
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS promotion_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pos_delivery_orders_promotion'
    ) THEN
        ALTER TABLE pos_delivery_orders
            ADD CONSTRAINT fk_pos_delivery_orders_promotion
            FOREIGN KEY (promotion_id) REFERENCES promotions(id);
    END IF;
END $$;

UPDATE pos_delivery_orders
SET subtotal_amount = total_amount
WHERE subtotal_amount IS NULL;
