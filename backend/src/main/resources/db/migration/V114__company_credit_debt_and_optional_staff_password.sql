ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS company_obligations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id     UUID           NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    kind         VARCHAR(16)    NOT NULL,
    party_name   VARCHAR(160)   NOT NULL,
    description  TEXT           NOT NULL,
    amount       NUMERIC(14, 2) NOT NULL,
    entry_date   DATE           NOT NULL,
    due_date     DATE,
    status       VARCHAR(16)    NOT NULL DEFAULT 'OPEN',
    reference_no VARCHAR(120),
    recorded_by  VARCHAR(160),
    settled_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT chk_company_obligation_kind CHECK (kind IN ('CREDIT', 'DEBT')),
    CONSTRAINT chk_company_obligation_status CHECK (status IN ('OPEN', 'SETTLED')),
    CONSTRAINT chk_company_obligation_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_company_obligations_hotel
    ON company_obligations(hotel_id, entry_date DESC);
