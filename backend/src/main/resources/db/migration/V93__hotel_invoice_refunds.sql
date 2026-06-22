-- Reservation & facility invoice refunds (POS uses depot_sale_refunds)

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ISSUED';

CREATE TABLE IF NOT EXISTS hotel_invoice_refunds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id),
    source_type     VARCHAR(32) NOT NULL,
    source_id       UUID NOT NULL,
    source_number   VARCHAR(64) NOT NULL,
    refund_number   VARCHAR(48) NOT NULL UNIQUE,
    refund_amount   NUMERIC(14, 2) NOT NULL,
    refund_method   VARCHAR(32),
    reason          TEXT,
    status          VARCHAR(16) NOT NULL DEFAULT 'COMPLETED',
    created_by      VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_invoice_refunds_hotel ON hotel_invoice_refunds(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_invoice_refunds_source ON hotel_invoice_refunds(source_type, source_id);

UPDATE invoices SET status = 'ISSUED' WHERE status IS NULL OR status = '';
