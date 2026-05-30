ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS recipient_address VARCHAR(255);
