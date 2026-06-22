-- POS depot sale refunds (full refund restores outlet stock)

ALTER TABLE depot_sales
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'COMPLETED';

ALTER TABLE depot_sale_lines
    ADD COLUMN IF NOT EXISTS quantity_refunded NUMERIC(14, 3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS depot_sale_refunds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id),
    sale_id         UUID NOT NULL REFERENCES depot_sales(id),
    refund_number   VARCHAR(48) NOT NULL UNIQUE,
    refund_amount   NUMERIC(14, 2) NOT NULL,
    refund_method   VARCHAR(32),
    reason          TEXT,
    status          VARCHAR(16) NOT NULL DEFAULT 'COMPLETED',
    created_by      VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_depot_sale_refunds_hotel ON depot_sale_refunds(hotel_id);
CREATE INDEX IF NOT EXISTS idx_depot_sale_refunds_sale ON depot_sale_refunds(sale_id);

CREATE TABLE IF NOT EXISTS depot_sale_refund_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id           UUID NOT NULL REFERENCES depot_sale_refunds(id) ON DELETE CASCADE,
    sale_line_id        UUID NOT NULL REFERENCES depot_sale_lines(id),
    product_id          UUID NOT NULL REFERENCES depot_products(id),
    quantity_refunded   NUMERIC(14, 3) NOT NULL,
    unit_price          NUMERIC(14, 2) NOT NULL,
    line_total          NUMERIC(14, 2) NOT NULL,
    line_order          INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_depot_sale_refund_lines_refund ON depot_sale_refund_lines(refund_id);

UPDATE depot_sales SET status = 'COMPLETED' WHERE status IS NULL OR status = '';
