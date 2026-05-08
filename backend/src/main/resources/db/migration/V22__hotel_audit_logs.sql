-- Hotel-level audit log (durable, queryable — replaces SLF4J-only approach)
CREATE TABLE hotel_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(id),
    actor_user_id   UUID,
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       UUID,
    details         TEXT,           -- JSON blob
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hotel_audit_hotel_created ON hotel_audit_logs(hotel_id, created_at DESC);
CREATE INDEX idx_hotel_audit_action ON hotel_audit_logs(action);
