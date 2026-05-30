CREATE TABLE IF NOT EXISTS facility_abonnements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    code VARCHAR(64) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(64),
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    visit_limit INT,
    visits_used INT NOT NULL DEFAULT 0,
    monthly_billing BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_facility_abonnement_hotel_code UNIQUE (hotel_id, code),
    CONSTRAINT ck_facility_abonnement_dates CHECK (valid_until >= valid_from),
    CONSTRAINT ck_facility_abonnement_visit_limit CHECK (visit_limit IS NULL OR visit_limit >= 0),
    CONSTRAINT ck_facility_abonnement_visits_used CHECK (visits_used >= 0)
);

CREATE TABLE IF NOT EXISTS facility_abonnement_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abonnement_id UUID NOT NULL REFERENCES facility_abonnements(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT uq_facility_abonnement_facility UNIQUE (abonnement_id, facility_id)
);

ALTER TABLE facility_bookings
    ADD COLUMN IF NOT EXISTS abonnement_id UUID REFERENCES facility_abonnements(id);

CREATE INDEX IF NOT EXISTS idx_facility_abonnements_hotel_code ON facility_abonnements(hotel_id, code);
CREATE INDEX IF NOT EXISTS idx_facility_abonnements_hotel_active ON facility_abonnements(hotel_id, is_active);
CREATE INDEX IF NOT EXISTS idx_facility_abonnement_facilities_facility ON facility_abonnement_facilities(facility_id);
