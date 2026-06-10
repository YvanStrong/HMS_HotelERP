CREATE TABLE staff_push_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id   UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    push_token VARCHAR(300) NOT NULL,
    platform   VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
    device_id  VARCHAR(200),
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, user_id, device_id)
);

CREATE INDEX idx_staff_push_tokens_user_active ON staff_push_tokens(user_id) WHERE is_active = true;
