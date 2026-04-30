CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    reservation_id UUID NOT NULL REFERENCES reservations(id),
    payment_type VARCHAR(20) NOT NULL,
    method VARCHAR(30) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    reference VARCHAR(200),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_by UUID REFERENCES app_users(id),
    is_deposit BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    void_reason TEXT,
    voided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_hotel ON payments(hotel_id);
