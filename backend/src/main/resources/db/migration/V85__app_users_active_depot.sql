ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS active_depot_id UUID REFERENCES inventory_depots(id);

CREATE INDEX IF NOT EXISTS idx_app_users_active_depot ON app_users(active_depot_id);
