-- Mobile POS: sale/delivery metadata, line notes, table tickets

ALTER TABLE depot_sales
    ADD COLUMN IF NOT EXISTS table_label VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE depot_sale_lines
    ADD COLUMN IF NOT EXISTS line_notes TEXT;

ALTER TABLE pos_delivery_orders
    ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE pos_delivery_order_lines
    ADD COLUMN IF NOT EXISTS line_notes TEXT;

CREATE TABLE IF NOT EXISTS pos_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    depot_id UUID NOT NULL REFERENCES inventory_depots(id) ON DELETE CASCADE,
    table_label VARCHAR(64) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_pos_table_depot_label UNIQUE (depot_id, table_label)
);

CREATE INDEX IF NOT EXISTS idx_pos_tables_hotel_depot ON pos_tables(hotel_id, depot_id, sort_order);

CREATE TABLE IF NOT EXISTS pos_table_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    depot_id UUID NOT NULL REFERENCES inventory_depots(id) ON DELETE CASCADE,
    table_id UUID REFERENCES pos_tables(id) ON DELETE SET NULL,
    table_label VARCHAR(255) NOT NULL,
    staff_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    customer_name VARCHAR(255),
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    delivery_order_id UUID REFERENCES pos_delivery_orders(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES depot_sales(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pos_table_tickets_status_check CHECK (
        status IN ('OPEN', 'SENT_TO_KITCHEN', 'SERVED', 'CLOSED', 'CANCELLED')
    )
);

CREATE INDEX IF NOT EXISTS idx_pos_table_tickets_hotel_depot_status
    ON pos_table_tickets(hotel_id, depot_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS pos_table_ticket_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES pos_table_tickets(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES depot_products(id),
    line_order INT NOT NULL DEFAULT 0,
    quantity NUMERIC(14, 3) NOT NULL,
    unit_price NUMERIC(14, 2) NOT NULL,
    line_total NUMERIC(14, 2) NOT NULL,
    line_notes TEXT,
    line_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    taxable BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT pos_table_ticket_lines_status_check CHECK (
        line_status IN ('PENDING', 'PREPARING', 'READY', 'SERVED')
    )
);

CREATE INDEX IF NOT EXISTS idx_pos_table_ticket_lines_ticket ON pos_table_ticket_lines(ticket_id);
