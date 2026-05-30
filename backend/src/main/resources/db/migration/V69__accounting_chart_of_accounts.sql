CREATE TABLE IF NOT EXISTS accounting_accounts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id     UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    code         VARCHAR(20) NOT NULL,
    name         VARCHAR(120) NOT NULL,
    account_type VARCHAR(32) NOT NULL,
    description  TEXT,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_accounting_accounts_hotel_code UNIQUE (hotel_id, code),
    CONSTRAINT chk_accounting_account_type CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'))
);

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_hotel_type_code
    ON accounting_accounts(hotel_id, account_type, code);

