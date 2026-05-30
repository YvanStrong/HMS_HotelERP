CREATE TABLE IF NOT EXISTS pos_delivery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    depot_id UUID NOT NULL REFERENCES inventory_depots(id),
    sale_id UUID REFERENCES depot_sales(id) ON DELETE SET NULL,
    delivery_number VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255),
    location_label VARCHAR(255),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_by VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    invoiced_at TIMESTAMPTZ,
    CONSTRAINT uq_pos_delivery_hotel_number UNIQUE (hotel_id, delivery_number),
    CONSTRAINT pos_delivery_orders_status_check CHECK (status IN ('PENDING', 'INVOICED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS pos_delivery_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id UUID NOT NULL REFERENCES pos_delivery_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES depot_products(id),
    line_order INT NOT NULL DEFAULT 0,
    quantity NUMERIC(14, 3) NOT NULL,
    unit_price NUMERIC(14, 2) NOT NULL,
    line_total NUMERIC(14, 2) NOT NULL,
    taxable BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pos_delivery_orders_hotel_created ON pos_delivery_orders(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_delivery_orders_status ON pos_delivery_orders(hotel_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_delivery_order_lines_order ON pos_delivery_order_lines(delivery_order_id);
