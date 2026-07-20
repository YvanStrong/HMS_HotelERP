CREATE TABLE pos_announcements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id    UUID NOT NULL REFERENCES hotels(id),
    depot_id    UUID REFERENCES inventory_depots(id),
    message     TEXT NOT NULL,
    type        VARCHAR(20) DEFAULT 'INFO'
                CHECK (type IN ('INFO', 'WARNING', 'URGENT')),
    created_by  UUID NOT NULL REFERENCES app_users(id),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP,
    is_active   BOOLEAN DEFAULT true
);

CREATE TABLE pos_announcement_reads (
    announcement_id UUID NOT NULL REFERENCES pos_announcements(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES app_users(id),
    read_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX idx_pos_announcements_hotel_active ON pos_announcements (hotel_id, is_active, expires_at);
