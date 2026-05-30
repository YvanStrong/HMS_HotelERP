CREATE TABLE IF NOT EXISTS pos_proformas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    depot_id UUID NOT NULL REFERENCES inventory_depots(id),
    proforma_number VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_by VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_pos_proforma_hotel_number UNIQUE (hotel_id, proforma_number)
);

CREATE TABLE IF NOT EXISTS pos_proforma_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proforma_id UUID NOT NULL REFERENCES pos_proformas(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES depot_products(id),
    line_order INT NOT NULL DEFAULT 0,
    quantity NUMERIC(14, 3) NOT NULL,
    unit_price NUMERIC(14, 2) NOT NULL,
    line_total NUMERIC(14, 2) NOT NULL,
    taxable BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pos_proformas_hotel_created ON pos_proformas(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_proformas_depot ON pos_proformas(depot_id);
CREATE INDEX IF NOT EXISTS idx_pos_proforma_lines_proforma ON pos_proforma_lines(proforma_id);
