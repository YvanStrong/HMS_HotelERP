CREATE TABLE IF NOT EXISTS accounting_receivables (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    invoice_ref VARCHAR(128),
    issue_date DATE NOT NULL,
    due_date DATE,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_receivables_hotel_status
    ON accounting_receivables(hotel_id, status, due_date);

CREATE TABLE IF NOT EXISTS accounting_payables (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255) NOT NULL,
    bill_ref VARCHAR(128),
    bill_date DATE NOT NULL,
    due_date DATE,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_payables_hotel_status
    ON accounting_payables(hotel_id, status, due_date);

CREATE TABLE IF NOT EXISTS accounting_budgets (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    month INTEGER,
    account_code VARCHAR(32) NOT NULL,
    account_name VARCHAR(160) NOT NULL,
    budget_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_accounting_budgets_month CHECK (month IS NULL OR month BETWEEN 1 AND 12)
);

CREATE INDEX IF NOT EXISTS idx_accounting_budgets_hotel_year
    ON accounting_budgets(hotel_id, fiscal_year, month, account_code);

CREATE TABLE IF NOT EXISTS accounting_tax_filings (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    tax_type VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    taxable_sales NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tax_collected NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tax_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tax_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    filing_reference VARCHAR(128),
    filed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_tax_filings_hotel_period
    ON accounting_tax_filings(hotel_id, period_start, period_end, status);

CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    period_name VARCHAR(120) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    closed_at TIMESTAMPTZ,
    closed_by VARCHAR(128),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_hotel_status
    ON accounting_periods(hotel_id, status, start_date, end_date);

CREATE TABLE IF NOT EXISTS accounting_reconciliations (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    bank_name VARCHAR(160) NOT NULL,
    statement_start DATE NOT NULL,
    statement_end DATE NOT NULL,
    statement_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    system_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    difference NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    reconciled_at TIMESTAMPTZ,
    reconciled_by VARCHAR(128),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_reconciliations_hotel_status
    ON accounting_reconciliations(hotel_id, status, statement_end);
