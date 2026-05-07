-- Guest call-out / pickup context (counter "Order for …", KDS, lobby board)
ALTER TABLE self_service_orders
    ADD COLUMN IF NOT EXISTS pickup_display_name VARCHAR(64),
    ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(48),
    ADD COLUMN IF NOT EXISTS sms_notify_phone VARCHAR(24);

-- Web Push subscriptions for "notify when ready" (one row per device endpoint per track token)
CREATE TABLE IF NOT EXISTS self_order_push_subscriptions (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels (id) ON DELETE CASCADE,
    track_token UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth_secret VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_order_push_track ON self_order_push_subscriptions (track_token);
CREATE INDEX IF NOT EXISTS idx_self_order_push_hotel ON self_order_push_subscriptions (hotel_id);
