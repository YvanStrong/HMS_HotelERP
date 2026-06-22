-- POS / depot sale payment method (default CASH)

ALTER TABLE depot_sales
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH';

UPDATE depot_sales SET payment_method = 'CASH' WHERE payment_method IS NULL OR payment_method = '';
