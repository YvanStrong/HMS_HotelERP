-- Inventory fabrication / bill of materials.
-- A formula defines the ingredients required for one unit of a finished product.

CREATE TABLE IF NOT EXISTS inv_fabrication_formulas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID           NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    output_item_id  UUID           NOT NULL REFERENCES inventory_items(id),
    name            VARCHAR(160)   NOT NULL,
    output_quantity NUMERIC(14, 4) NOT NULL DEFAULT 1,
    notes           TEXT,
    active          BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_fabrication_formulas_hotel
    ON inv_fabrication_formulas(hotel_id, active, name);

CREATE TABLE IF NOT EXISTS inv_fabrication_formula_lines (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id     UUID           NOT NULL REFERENCES inv_fabrication_formulas(id) ON DELETE CASCADE,
    component_id   UUID           NOT NULL REFERENCES inventory_items(id),
    quantity       NUMERIC(14, 4) NOT NULL,
    notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_inv_fabrication_formula_lines_formula
    ON inv_fabrication_formula_lines(formula_id);

CREATE TABLE IF NOT EXISTS inv_fabrication_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id          UUID           NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    formula_id        UUID           NOT NULL REFERENCES inv_fabrication_formulas(id),
    output_item_id    UUID           NOT NULL REFERENCES inventory_items(id),
    quantity_produced NUMERIC(14, 4) NOT NULL,
    reference_no      VARCHAR(80),
    notes             TEXT,
    created_by        VARCHAR(160),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_fabrication_runs_hotel
    ON inv_fabrication_runs(hotel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inv_fabrication_run_lines (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id            UUID           NOT NULL REFERENCES inv_fabrication_runs(id) ON DELETE CASCADE,
    component_id      UUID           NOT NULL REFERENCES inventory_items(id),
    required_quantity NUMERIC(14, 4) NOT NULL,
    stock_before      NUMERIC(14, 4) NOT NULL,
    stock_after       NUMERIC(14, 4) NOT NULL
);
