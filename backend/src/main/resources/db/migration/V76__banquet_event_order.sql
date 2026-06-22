CREATE TABLE IF NOT EXISTS banquet_event_order (
    id UUID PRIMARY KEY,
    event_booking_id UUID NOT NULL UNIQUE REFERENCES event_booking(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    distributed_at TIMESTAMP,
    locked_at TIMESTAMP,
    agenda_items TEXT,
    setup_style VARCHAR(80),
    room_layout_notes TEXT,
    expected_pax INTEGER,
    guaranteed_pax INTEGER,
    av_requirements TEXT,
    equipment_list TEXT,
    menu_notes TEXT,
    dietary_restrictions TEXT,
    service_timings TEXT,
    beverage_notes TEXT,
    banquet_staff_count INTEGER,
    kitchen_notes TEXT,
    housekeeping_notes TEXT,
    maintenance_notes TEXT,
    security_notes TEXT,
    finance_notes TEXT,
    deposit_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    internal_notes TEXT,
    created_by VARCHAR(120),
    last_updated_by VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_banquet_event_order_status CHECK (
        status IN ('DRAFT', 'DISTRIBUTED', 'REVISED', 'LOCKED', 'COMPLETED')
    )
);

CREATE INDEX IF NOT EXISTS idx_banquet_event_order_status ON banquet_event_order(status);
