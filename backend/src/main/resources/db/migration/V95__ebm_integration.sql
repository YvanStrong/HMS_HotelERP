-- EBM (RRA Electronic Billing Machine) — web/CIS integration
-- Enforces sequencing: TRANSACTION → INVOICE → STOCK_IO → STOCK_MASTER
-- and lastReqDt cursors for delta pulls.

CREATE TABLE IF NOT EXISTS ebm_device (
    id                    UUID PRIMARY KEY,
    hotel_id              UUID NOT NULL REFERENCES hotels(id),
    mode                  VARCHAR(8) NOT NULL,
    tin                   VARCHAR(32) NOT NULL,
    branch_id             VARCHAR(32),
    device_serial_no      VARCHAR(64) NOT NULL,
    sdc_id                VARCHAR(64),
    mrc_no                VARCHAR(64),
    encrypted_signing_key TEXT,
    key_version           INT NOT NULL DEFAULT 1,
    vsdc_endpoint_url     TEXT,
    status                VARCHAR(16) NOT NULL DEFAULT 'PENDING_INIT',
    last_signature_at     TIMESTAMPTZ,
    last_error            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_ebm_device_mode CHECK (mode IN ('VSDC', 'OSDC')),
    CONSTRAINT ck_ebm_device_status CHECK (status IN ('PENDING_INIT', 'ACTIVE', 'DISABLED', 'ERROR'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ebm_device_hotel_serial
    ON ebm_device (hotel_id, device_serial_no);

CREATE TABLE IF NOT EXISTS ebm_sync_cursor (
    device_id   UUID NOT NULL REFERENCES ebm_device(id) ON DELETE CASCADE,
    category    VARCHAR(32) NOT NULL,
    last_req_dt TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, category)
);

CREATE TABLE IF NOT EXISTS taxable_sale_event (
    id              UUID PRIMARY KEY,
    hotel_id        UUID NOT NULL REFERENCES hotels(id),
    device_id       UUID REFERENCES ebm_device(id),
    source_type     VARCHAR(24) NOT NULL,
    source_id       UUID NOT NULL,
    document_number VARCHAR(64),
    ebm_receipt_no  VARCHAR(64),
    ebm_signature   TEXT,
    ebm_qr_payload  TEXT,
    ebm_status      VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_taxable_sale_source CHECK (
        source_type IN ('INVOICE', 'DEPOT_SALE', 'INV_SALES_INVOICE', 'FB_ORDER')
    ),
    CONSTRAINT ck_taxable_sale_status CHECK (
        ebm_status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'SKIPPED')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_taxable_sale_source
    ON taxable_sale_event (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_taxable_sale_hotel_status
    ON taxable_sale_event (hotel_id, ebm_status);

CREATE TABLE IF NOT EXISTS ebm_outbox (
    id             UUID PRIMARY KEY,
    device_id      UUID NOT NULL REFERENCES ebm_device(id),
    sale_event_id  UUID REFERENCES taxable_sale_event(id),
    phase          VARCHAR(24) NOT NULL,
    status         VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    depends_on_id  UUID REFERENCES ebm_outbox(id),
    payload        JSONB NOT NULL,
    response       JSONB,
    attempts       INT NOT NULL DEFAULT 0,
    last_error     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at   TIMESTAMPTZ,
    acked_at       TIMESTAMPTZ,
    CONSTRAINT ck_ebm_outbox_phase CHECK (
        phase IN ('TRANSACTION', 'INVOICE', 'STOCK_IO', 'STOCK_MASTER')
    ),
    CONSTRAINT ck_ebm_outbox_status CHECK (
        status IN ('PENDING', 'SENT', 'ACKED', 'FAILED', 'BLOCKED')
    )
);

CREATE INDEX IF NOT EXISTS idx_ebm_outbox_pending
    ON ebm_outbox (device_id, status, created_at)
    WHERE status IN ('PENDING', 'FAILED');

CREATE TABLE IF NOT EXISTS ebm_item_cd_sequence (
    hotel_id    UUID PRIMARY KEY REFERENCES hotels(id),
    last_number BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS item_cd VARCHAR(20),
    ADD COLUMN IF NOT EXISTS item_cls_cd VARCHAR(16),
    ADD COLUMN IF NOT EXISTS item_ty_cd VARCHAR(4),
    ADD COLUMN IF NOT EXISTS pkg_unit_cd VARCHAR(4),
    ADD COLUMN IF NOT EXISTS qty_unit_cd VARCHAR(4);

CREATE UNIQUE INDEX IF NOT EXISTS uk_inventory_items_item_cd
    ON inventory_items (item_cd)
    WHERE item_cd IS NOT NULL;

ALTER TABLE depot_products
    ADD COLUMN IF NOT EXISTS item_cd VARCHAR(20),
    ADD COLUMN IF NOT EXISTS item_cls_cd VARCHAR(16),
    ADD COLUMN IF NOT EXISTS item_ty_cd VARCHAR(4),
    ADD COLUMN IF NOT EXISTS pkg_unit_cd VARCHAR(4),
    ADD COLUMN IF NOT EXISTS qty_unit_cd VARCHAR(4);

CREATE UNIQUE INDEX IF NOT EXISTS uk_depot_products_item_cd
    ON depot_products (item_cd)
    WHERE item_cd IS NOT NULL;
