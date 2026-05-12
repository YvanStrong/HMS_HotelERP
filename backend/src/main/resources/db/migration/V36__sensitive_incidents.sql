CREATE TABLE IF NOT EXISTS sensitive_incidents (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    guest_id UUID REFERENCES guests(id),
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    description TEXT NOT NULL,
    action_taken TEXT,
    reported_at TIMESTAMP NOT NULL,
    reported_by UUID REFERENCES app_users(id)
);

CREATE INDEX IF NOT EXISTS idx_incident_guest ON sensitive_incidents(guest_id);
CREATE INDEX IF NOT EXISTS idx_incident_hotel ON sensitive_incidents(hotel_id);
