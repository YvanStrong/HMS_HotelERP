ALTER TABLE hotel_audit_logs
    ADD COLUMN IF NOT EXISTS actor_username VARCHAR(120);

ALTER TABLE hotel_audit_logs
    ALTER COLUMN action TYPE VARCHAR(160);
