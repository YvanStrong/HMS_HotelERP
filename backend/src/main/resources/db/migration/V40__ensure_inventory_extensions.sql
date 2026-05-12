-- Same idempotent DDL as V33 + V34 for DBs where version 33/34 was checksum-repaired
-- to a different script and inventory extensions never ran.

-- ----- V33 inventory extensions -----

CREATE TABLE IF NOT EXISTS inv_warehouses (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name            VARCHAR(128) NOT NULL,
    code            VARCHAR(32)  NOT NULL,
    address         TEXT,
    is_default      BOOLEAN      NOT NULL DEFAULT false,
    active          BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_inv_warehouse_hotel_code UNIQUE (hotel_id, code)
);

CREATE TABLE IF NOT EXISTS inv_customers (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id            UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    code                VARCHAR(32),
    phone               VARCHAR(32),
    email               VARCHAR(128),
    address             TEXT,
    credit_limit        NUMERIC(14,2) NOT NULL DEFAULT 0,
    outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    active              BOOLEAN      NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inv_sales_invoices (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    customer_id     UUID        REFERENCES inv_customers(id),
    invoice_number  VARCHAR(64)  NOT NULL,
    status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    invoice_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE,
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_paid     NUMERIC(14,2) NOT NULL DEFAULT 0,
    payment_method  VARCHAR(32),
    notes           TEXT,
    customer_name   VARCHAR(255),
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inv_sales_invoice_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID        NOT NULL REFERENCES inv_sales_invoices(id) ON DELETE CASCADE,
    item_id         UUID        NOT NULL REFERENCES inventory_items(id),
    item_name       VARCHAR(255) NOT NULL,
    quantity        NUMERIC(14,4) NOT NULL,
    unit_price      NUMERIC(14,2) NOT NULL,
    discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
    tax_rate        NUMERIC(5,2)  NOT NULL DEFAULT 0,
    subtotal        NUMERIC(14,2) NOT NULL,
    cost_price      NUMERIC(14,2)
);

CREATE TABLE IF NOT EXISTS inv_stock_transfers (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id            UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    from_warehouse_id   UUID        NOT NULL REFERENCES inv_warehouses(id),
    to_warehouse_id     UUID        NOT NULL REFERENCES inv_warehouses(id),
    transfer_number     VARCHAR(64)  NOT NULL,
    status              VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    transfer_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
    notes               TEXT,
    transferred_by      VARCHAR(255),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inv_stock_transfer_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id     UUID        NOT NULL REFERENCES inv_stock_transfers(id) ON DELETE CASCADE,
    item_id         UUID        NOT NULL REFERENCES inventory_items(id),
    quantity        NUMERIC(14,4) NOT NULL,
    unit_cost       NUMERIC(14,2)
);

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit_limit        NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_inv_wh_hotel       ON inv_warehouses(hotel_id);
CREATE INDEX IF NOT EXISTS idx_inv_cust_hotel      ON inv_customers(hotel_id);
CREATE INDEX IF NOT EXISTS idx_inv_inv_hotel       ON inv_sales_invoices(hotel_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_inv_customer    ON inv_sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_hotel  ON inv_stock_transfers(hotel_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_tx_item       ON stock_transactions(item_id, timestamp DESC);

-- ----- V34 inventory product fields -----

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS selling_price NUMERIC(14, 4),
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS manufacture_date DATE;

CREATE INDEX IF NOT EXISTS idx_inv_items_hotel_active ON inventory_items (hotel_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_items_expiry ON inventory_items (hotel_id, expiry_date) WHERE expiry_date IS NOT NULL;
