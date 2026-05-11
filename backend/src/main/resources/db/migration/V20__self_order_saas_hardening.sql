-- Optimistic locking for concurrent kiosk stock decrements
ALTER TABLE depot_products
    ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 0;

-- Idempotent place-order (double-submit / flaky Wi-Fi)
CREATE TABLE IF NOT EXISTS self_order_idempotency (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
    key_hash CHAR(64) NOT NULL,
    response_json TEXT NOT NULL,
    primary_track_token UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_self_order_idem_hotel_hash UNIQUE (hotel_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_self_order_idem_expires ON self_order_idempotency (expires_at);

-- Append-only analytics / audit stream for self-order domain
CREATE TABLE IF NOT EXISTS self_order_events (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
    order_id UUID REFERENCES self_service_orders (id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_json TEXT,
    correlation_id VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_order_events_hotel_time ON self_order_events (hotel_id, created_at DESC);

-- READY notification outcome (staff visibility + support)
ALTER TABLE self_service_orders
    ADD COLUMN IF NOT EXISTS last_notify_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_notify_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS last_notify_detail VARCHAR(512),
    ADD COLUMN IF NOT EXISTS sms_consent_version VARCHAR(16),
    ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMP;

-- Tenant-level channel toggles (global Twilio/VAPID still in app config)
ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS self_order_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS self_order_push_enabled BOOLEAN NOT NULL DEFAULT TRUE;
