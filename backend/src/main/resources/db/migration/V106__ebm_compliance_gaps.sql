-- EBM compliance gaps: customer TIN, code-list cache, expanded source/phase types, fiscal print fields

ALTER TABLE depot_sales
    ADD COLUMN IF NOT EXISTS customer_tin VARCHAR(16);

ALTER TABLE taxable_sale_event
    ADD COLUMN IF NOT EXISTS ebm_sdc_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ebm_mrc_no VARCHAR(64);

ALTER TABLE taxable_sale_event DROP CONSTRAINT IF EXISTS ck_taxable_sale_source;
ALTER TABLE taxable_sale_event
    ADD CONSTRAINT ck_taxable_sale_source CHECK (
        source_type IN (
            'INVOICE',
            'DEPOT_SALE',
            'INV_SALES_INVOICE',
            'FB_ORDER',
            'DEPOT_REFUND',
            'INV_SALES_RETURN',
            'INVOICE_REFUND',
            'PURCHASE_RECEIVE',
            'PURCHASE_RETURN',
            'ITEM_SAVE'
        )
    );

ALTER TABLE ebm_outbox DROP CONSTRAINT IF EXISTS ck_ebm_outbox_phase;
ALTER TABLE ebm_outbox
    ADD CONSTRAINT ck_ebm_outbox_phase CHECK (
        phase IN (
            'TRANSACTION',
            'INVOICE',
            'STOCK_IO',
            'STOCK_MASTER',
            'PURCHASE',
            'ITEM_SAVE'
        )
    );

CREATE TABLE IF NOT EXISTS ebm_code_list (
    id          UUID PRIMARY KEY,
    hotel_id    UUID NOT NULL REFERENCES hotels(id),
    device_id   UUID REFERENCES ebm_device(id) ON DELETE SET NULL,
    category    VARCHAR(32) NOT NULL,
    code        VARCHAR(64) NOT NULL,
    name        VARCHAR(255),
    parent_code VARCHAR(64),
    raw_json    JSONB,
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ebm_code_list UNIQUE (hotel_id, category, code)
);

CREATE INDEX IF NOT EXISTS idx_ebm_code_list_hotel_cat
    ON ebm_code_list (hotel_id, category);
