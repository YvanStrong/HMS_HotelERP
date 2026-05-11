-- ============================================================
-- V32: Pool & Recreational Facilities Enhancements
-- Water quality logs, lifeguard roster, incident reporting,
-- maintenance sign-off columns
-- ============================================================

-- Water quality / chemical balance records
CREATE TABLE IF NOT EXISTS facility_water_quality_logs (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id             UUID        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    logged_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    logged_by               VARCHAR(255) NOT NULL,
    ph_level                NUMERIC(5,2),
    free_chlorine_ppm       NUMERIC(5,2),
    combined_chlorine_ppm   NUMERIC(5,2),
    temperature_celsius     NUMERIC(5,2),
    turbidity_ntu           NUMERIC(7,3),
    total_dissolved_solids  INTEGER,
    alkalinity_ppm          NUMERIC(7,2),
    calcium_hardness_ppm    NUMERIC(7,2),
    notes                   TEXT,
    passed_inspection       BOOLEAN NOT NULL DEFAULT true,
    inspector_name          VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_water_quality_facility
    ON facility_water_quality_logs(facility_id, logged_at DESC);

-- Lifeguard / staff roster for facilities
CREATE TABLE IF NOT EXISTS facility_lifeguard_roster (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id                UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    facility_id             UUID        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    staff_name              VARCHAR(255) NOT NULL,
    staff_email             VARCHAR(255),
    certification_name      VARCHAR(255),
    certification_expiry    DATE,
    shift_date              DATE        NOT NULL,
    shift_start             TIME WITHOUT TIME ZONE NOT NULL,
    shift_end               TIME WITHOUT TIME ZONE NOT NULL,
    status                  VARCHAR(64) NOT NULL DEFAULT 'SCHEDULED',
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifeguard_facility_date
    ON facility_lifeguard_roster(facility_id, shift_date);

-- Facility incidents (safety, accidents, near-misses)
CREATE TABLE IF NOT EXISTS facility_incidents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id     UUID        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    occurred_at     TIMESTAMPTZ NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    severity        VARCHAR(64) NOT NULL DEFAULT 'LOW',
    reported_by     VARCHAR(255) NOT NULL,
    witness_names   TEXT,
    status          VARCHAR(64) NOT NULL DEFAULT 'OPEN',
    resolution      TEXT,
    resolved_at     TIMESTAMPTZ,
    resolved_by     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_facility
    ON facility_incidents(facility_id, occurred_at DESC);

-- Add maintenance completion / sign-off columns
ALTER TABLE facility_maintenances
    ADD COLUMN IF NOT EXISTS completed_by       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS inspector_notes    TEXT,
    ADD COLUMN IF NOT EXISTS compliance_status  VARCHAR(64) DEFAULT 'PENDING';
