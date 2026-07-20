-- POS line voids, discounts, and immutable audit trail

CREATE TABLE pos_line_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    ticket_id       UUID NOT NULL REFERENCES pos_table_tickets(id) ON DELETE CASCADE,
    line_id         UUID NOT NULL REFERENCES pos_table_ticket_lines(id) ON DELETE CASCADE,
    action          VARCHAR(20) NOT NULL
                    CHECK (action IN ('VOID', 'DISCOUNT')),
    original_price  NUMERIC(10, 2) NOT NULL,
    original_qty    INT NOT NULL,
    discount_pct    NUMERIC(5, 2),
    discount_amount NUMERIC(10, 2),
    reason          TEXT NOT NULL,
    authorized_by   UUID NOT NULL REFERENCES app_users(id),
    authorized_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID NOT NULL REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pos_table_ticket_lines
    ADD COLUMN IF NOT EXISTS is_voided       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS void_reason     TEXT,
    ADD COLUMN IF NOT EXISTS discount_pct    NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS effective_price NUMERIC(10, 2);

CREATE INDEX idx_line_audit_ticket ON pos_line_audit(ticket_id);
CREATE INDEX idx_line_audit_hotel_date ON pos_line_audit(hotel_id, created_at DESC);
