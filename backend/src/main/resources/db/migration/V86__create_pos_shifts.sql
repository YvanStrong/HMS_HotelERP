CREATE TABLE pos_shifts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id            UUID NOT NULL REFERENCES hotels(id),
    depot_id            UUID NOT NULL REFERENCES inventory_depots(id),
    waiter_user_id      UUID NOT NULL REFERENCES app_users(id),
    waiter_name         VARCHAR(150) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'CLOSED')),

    opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,

    opening_float       NUMERIC(12, 2) NOT NULL DEFAULT 0,

    total_orders        INT DEFAULT 0,
    total_covers        INT DEFAULT 0,
    total_cash          NUMERIC(12, 2) DEFAULT 0,
    total_card          NUMERIC(12, 2) DEFAULT 0,
    total_room_charge   NUMERIC(12, 2) DEFAULT 0,
    total_revenue       NUMERIC(12, 2) DEFAULT 0,
    total_tax           NUMERIC(12, 2) DEFAULT 0,
    total_cancelled     INT DEFAULT 0,
    avg_ticket_value    NUMERIC(12, 2) DEFAULT 0,
    avg_serve_time_min  NUMERIC(8, 2) DEFAULT 0,

    closing_cash        NUMERIC(12, 2),
    cash_variance       NUMERIC(12, 2),
    closing_notes       TEXT,
    closed_by           UUID REFERENCES app_users(id),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pos_table_tickets
    ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES pos_shifts(id);

CREATE INDEX idx_pos_shifts_hotel_depot_status
    ON pos_shifts(hotel_id, depot_id, status);

CREATE INDEX idx_pos_shifts_waiter
    ON pos_shifts(hotel_id, waiter_user_id, opened_at DESC);

CREATE INDEX idx_tickets_shift
    ON pos_table_tickets(shift_id) WHERE shift_id IS NOT NULL;
