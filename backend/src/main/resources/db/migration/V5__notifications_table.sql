CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
    recipient_type VARCHAR(10) NOT NULL,
    recipient_id UUID NOT NULL,
    subject VARCHAR(255),
    body TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_hotel ON notifications(hotel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
