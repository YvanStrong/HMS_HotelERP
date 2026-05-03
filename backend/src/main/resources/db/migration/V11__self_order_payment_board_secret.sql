-- Self-order: pay-at-counter vs immediate payment; TV board optional shared secret.
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS order_board_secret VARCHAR(128);
ALTER TABLE self_service_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NOT NULL DEFAULT 'PAID';
ALTER TABLE self_service_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40);
