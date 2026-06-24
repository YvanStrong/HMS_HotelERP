ALTER TABLE pos_table_tickets
    ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tip_waiter_id UUID REFERENCES app_users(id);

ALTER TABLE pos_shifts
    ADD COLUMN IF NOT EXISTS total_tips NUMERIC(12, 2) DEFAULT 0;
