ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_app_users_hotel_active ON app_users(hotel_id, is_active);
