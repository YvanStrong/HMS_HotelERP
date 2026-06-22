-- Phase 3: rounds, totals, kitchen timestamps, line snapshots

ALTER TABLE pos_tables
    ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 4;

ALTER TABLE pos_table_tickets
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS guest_count INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS kitchen_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE pos_table_ticket_lines
    ADD COLUMN IF NOT EXISTS round INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS product_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;

UPDATE pos_table_ticket_lines l
SET product_name = p.product_name
FROM depot_products p
WHERE l.product_id = p.id
  AND (l.product_name IS NULL OR l.product_name = '');

ALTER TABLE pos_table_ticket_lines
    DROP CONSTRAINT IF EXISTS pos_table_ticket_lines_status_check;

ALTER TABLE pos_table_ticket_lines
    ADD CONSTRAINT pos_table_ticket_lines_status_check
    CHECK (line_status IN ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'));

CREATE INDEX IF NOT EXISTS idx_pos_table_tickets_table_open
    ON pos_table_tickets(table_id, status)
    WHERE status IN ('OPEN', 'SENT_TO_KITCHEN', 'SERVED');
