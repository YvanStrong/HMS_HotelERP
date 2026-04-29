-- Idempotent: DB may already have this table (e.g. prior ddl-auto / manual DDL) while flyway_schema_history was empty.
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    booking_id UUID REFERENCES reservations(id),
    task_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    assigned_to UUID REFERENCES app_users(id),
    assigned_by UUID REFERENCES app_users(id),
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    inspected_at TIMESTAMPTZ,
    inspected_by UUID REFERENCES app_users(id),
    inspection_score INT,
    notes TEXT,
    checklist_completed BOOLEAN NOT NULL DEFAULT FALSE,
    photo_url TEXT,
    dnd_skipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_hotel ON housekeeping_tasks(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_room ON housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned ON housekeeping_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status ON housekeeping_tasks(status);
