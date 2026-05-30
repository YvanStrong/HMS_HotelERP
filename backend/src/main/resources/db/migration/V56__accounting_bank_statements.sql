CREATE TABLE IF NOT EXISTS accounting_bank_statement_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID           NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    book_date       DATE           NOT NULL,
    value_date      DATE,
    reference       VARCHAR(120),
    narration       TEXT           NOT NULL,
    debit_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    credit_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
    balance_amount  NUMERIC(14, 2),
    source_bank     VARCHAR(80)    NOT NULL DEFAULT 'Bank of Kigali',
    recorded_by     VARCHAR(160),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT chk_bank_statement_non_negative CHECK (debit_amount >= 0 AND credit_amount >= 0),
    CONSTRAINT chk_bank_statement_has_amount CHECK (debit_amount > 0 OR credit_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_accounting_bank_statement_hotel_date
    ON accounting_bank_statement_lines(hotel_id, book_date DESC, created_at DESC);

