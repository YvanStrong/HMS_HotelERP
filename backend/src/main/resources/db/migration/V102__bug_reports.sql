CREATE TABLE bug_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    hotel_id        UUID REFERENCES hotels(id) ON DELETE SET NULL,
    reporter_username VARCHAR(128),
    reporter_email  VARCHAR(255),
    reporter_role   VARCHAR(64),
    page_url        VARCHAR(1024),
    title           VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    severity        VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status          VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    admin_notes     TEXT,
    email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
    email_error     VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    CONSTRAINT chk_bug_report_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_bug_report_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'WONT_FIX'))
);

CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX idx_bug_reports_hotel ON bug_reports(hotel_id);
