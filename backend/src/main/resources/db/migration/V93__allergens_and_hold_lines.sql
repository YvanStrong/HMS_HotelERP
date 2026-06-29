ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS dietary_flags JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS name_translations JSONB;

ALTER TABLE pos_table_ticket_lines
    ADD COLUMN IF NOT EXISTS is_held BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS hold_course VARCHAR(20)
        CHECK (hold_course IS NULL OR hold_course IN ('STARTER', 'MAIN', 'DESSERT'));
