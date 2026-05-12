CREATE TABLE guest_complaints (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    assigned_to UUID REFERENCES app_users (id) ON DELETE SET NULL,
    resolution TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_guest_complaints_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_guest_complaints_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX idx_guest_complaints_hotel_opened ON guest_complaints (hotel_id, opened_at DESC);
CREATE INDEX idx_guest_complaints_hotel_status ON guest_complaints (hotel_id, status);
CREATE INDEX idx_guest_complaints_guest ON guest_complaints (guest_id);
CREATE INDEX idx_guest_complaints_assigned ON guest_complaints (assigned_to);
