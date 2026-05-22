-- Accounting: expense recording and petty cash approval/disbursement workflow

CREATE TABLE IF NOT EXISTS accounting_expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID           NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    expense_date    DATE           NOT NULL,
    category        VARCHAR(80)    NOT NULL,
    vendor          VARCHAR(160),
    description     TEXT           NOT NULL,
    amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
    payment_method  VARCHAR(40),
    reference_no    VARCHAR(120),
    recorded_by     VARCHAR(160),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_expenses_hotel_date
    ON accounting_expenses(hotel_id, expense_date DESC);

CREATE TABLE IF NOT EXISTS petty_cash_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id         UUID           NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    request_number   VARCHAR(48)    NOT NULL UNIQUE,
    title            VARCHAR(160)   NOT NULL,
    category         VARCHAR(80)    NOT NULL,
    reason           TEXT           NOT NULL,
    amount_requested NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_approved  NUMERIC(14, 2),
    status           VARCHAR(32)    NOT NULL DEFAULT 'PENDING',
    requested_by     VARCHAR(160),
    approved_by      VARCHAR(160),
    approved_at      TIMESTAMPTZ,
    disbursed_by     VARCHAR(160),
    disbursed_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    notes            TEXT,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT chk_petty_cash_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'))
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_requests_hotel_status
    ON petty_cash_requests(hotel_id, status, created_at DESC);
