CREATE TABLE IF NOT EXISTS night_audit_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    run_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    rooms_audited INT NOT NULL DEFAULT 0,
    charges_posted INT NOT NULL DEFAULT 0,
    total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(8),
    errors TEXT,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    UNIQUE (hotel_id, run_date)
);

CREATE INDEX IF NOT EXISTS idx_night_audit_runs_hotel_date
    ON night_audit_runs(hotel_id, run_date DESC);
