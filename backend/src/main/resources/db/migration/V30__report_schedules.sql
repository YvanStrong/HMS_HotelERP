-- Scheduled report delivery
CREATE TABLE report_schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id    UUID NOT NULL REFERENCES hotels(id),
    report_type VARCHAR(30) NOT NULL,  -- OCCUPANCY, REVENUE, GUEST_ANALYTICS, INVENTORY, HOUSEKEEPING
    frequency   VARCHAR(20) NOT NULL,  -- DAILY, WEEKLY, MONTHLY
    recipients  TEXT NOT NULL,          -- comma-separated email addresses
    format      VARCHAR(10) NOT NULL DEFAULT 'PDF', -- PDF, CSV
    last_sent_at TIMESTAMPTZ,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_schedules_hotel ON report_schedules(hotel_id);
