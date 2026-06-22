CREATE TABLE IF NOT EXISTS event_billing_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    group_booking_id UUID NOT NULL REFERENCES group_bookings(id),
    event_booking_id UUID NOT NULL REFERENCES event_booking(id),
    event_quote_id UUID NOT NULL REFERENCES event_quote(id),
    document_type VARCHAR(16) NOT NULL,
    document_number VARCHAR(64) NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_event_billing_doc_quote UNIQUE (event_quote_id),
    CONSTRAINT uq_event_billing_doc_number UNIQUE (hotel_id, document_number)
);

CREATE INDEX IF NOT EXISTS idx_event_billing_docs_hotel_created
    ON event_billing_documents (hotel_id, created_at DESC);
