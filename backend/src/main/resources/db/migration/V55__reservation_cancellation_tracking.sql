ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_penalty NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS cancellation_refundable_amount NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS cancellation_policy_summary TEXT;
