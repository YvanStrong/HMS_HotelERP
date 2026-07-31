-- Mid-cycle renew / upgrade requests from hotels (admin confirms payment).
CREATE TABLE IF NOT EXISTS tenant_billing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL,
    target_tier VARCHAR(20),
    months INT,
    quoted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(8),
    payment_reference VARCHAR(120),
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_by UUID,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolve_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_billing_requests_status
    ON tenant_billing_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_billing_requests_hotel
    ON tenant_billing_requests (hotel_id, requested_at DESC);
