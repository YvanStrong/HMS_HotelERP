-- PMS reservation foundation: rich booking contract data without breaking existing reservations.

ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS arrival_time TIME,
    ADD COLUMN IF NOT EXISTS departure_time TIME,
    ADD COLUMN IF NOT EXISTS rooms_requested INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS child_ages_json TEXT,
    ADD COLUMN IF NOT EXISTS stay_purpose VARCHAR(64),
    ADD COLUMN IF NOT EXISTS booking_intent VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS waitlist_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS flexible_dates BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rate_plan_id UUID,
    ADD COLUMN IF NOT EXISTS rate_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS room_type_to_charge_id UUID,
    ADD COLUMN IF NOT EXISTS manual_rate_override NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS rate_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS rate_override_approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS packages_json TEXT,
    ADD COLUMN IF NOT EXISTS add_ons_json TEXT,
    ADD COLUMN IF NOT EXISTS room_features_json TEXT,
    ADD COLUMN IF NOT EXISTS upgrade_reason TEXT,
    ADD COLUMN IF NOT EXISTS reservation_type VARCHAR(64),
    ADD COLUMN IF NOT EXISTS market_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS origin_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS channel_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS company_id UUID,
    ADD COLUMN IF NOT EXISTS travel_agent_id UUID,
    ADD COLUMN IF NOT EXISTS commissionable BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS promo_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS campaign_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS guarantee_type VARCHAR(64),
    ADD COLUMN IF NOT EXISTS deduct_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deposit_due_date DATE,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS payment_token_id VARCHAR(200),
    ADD COLUMN IF NOT EXISTS authorization_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS direct_bill_company_id UUID,
    ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tax_exempt_reason TEXT,
    ADD COLUMN IF NOT EXISTS guarantee_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS guarantee_override_approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancellation_policy_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS deposit_policy_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS no_show_policy_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS registration_card_signed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS policy_snapshot_json TEXT,
    ADD COLUMN IF NOT EXISTS arrival_transport_type VARCHAR(64),
    ADD COLUMN IF NOT EXISTS flight_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS pickup_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS late_checkout_requested BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS housekeeping_instructions TEXT,
    ADD COLUMN IF NOT EXISTS amenity_instructions TEXT,
    ADD COLUMN IF NOT EXISTS internal_notes TEXT,
    ADD COLUMN IF NOT EXISTS guest_facing_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_reservations_market_code ON reservations(hotel_id, market_code);
CREATE INDEX IF NOT EXISTS idx_reservations_source_code ON reservations(hotel_id, source_code);
CREATE INDEX IF NOT EXISTS idx_reservations_channel_code ON reservations(hotel_id, channel_code);
CREATE INDEX IF NOT EXISTS idx_reservations_deposit_due ON reservations(hotel_id, deposit_due_date) WHERE deposit_required = TRUE;
CREATE INDEX IF NOT EXISTS idx_reservations_booking_intent ON reservations(hotel_id, booking_intent);

CREATE TABLE IF NOT EXISTS reservation_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'COMPANION',
    full_name VARCHAR(200) NOT NULL,
    preferred_name VARCHAR(120),
    email VARCHAR(128),
    phone VARCHAR(64),
    nationality VARCHAR(64),
    id_document_type VARCHAR(64),
    id_document_number VARCHAR(100),
    id_expiry_date DATE,
    preferred_language VARCHAR(32),
    communication_preference VARCHAR(32),
    operational_message_consent BOOLEAN NOT NULL DEFAULT FALSE,
    accessibility_needs TEXT,
    dietary_restrictions TEXT,
    allergies TEXT,
    room_feature_preferences TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_guests_reservation ON reservation_guests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_guest ON reservation_guests(guest_id);

CREATE TABLE IF NOT EXISTS reservation_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    room_type_to_charge_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    segment_start DATE NOT NULL,
    segment_end DATE NOT NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    rate_plan_id UUID,
    rate_code VARCHAR(64),
    nightly_rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    packages_json TEXT,
    add_ons_json TEXT,
    room_features_json TEXT,
    upgrade_reason TEXT,
    assignment_status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_segments_reservation ON reservation_segments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_segments_dates ON reservation_segments(hotel_id, segment_start, segment_end);

CREATE TABLE IF NOT EXISTS reservation_policy_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    cancellation_policy_id VARCHAR(128),
    deposit_policy_id VARCHAR(128),
    no_show_policy_id VARCHAR(128),
    cancellation_summary TEXT,
    deposit_summary TEXT,
    no_show_summary TEXT,
    policy_snapshot_json TEXT,
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted_at TIMESTAMPTZ,
    registration_card_signed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    detail TEXT,
    actor VARCHAR(128),
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_events_reservation ON reservation_events(reservation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservation_events_hotel ON reservation_events(hotel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS waitlist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    group_booking_id UUID REFERENCES group_bookings(id) ON DELETE SET NULL,
    requested_check_in DATE NOT NULL,
    requested_check_out DATE NOT NULL,
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    child_ages_json TEXT,
    flexible_dates BOOLEAN NOT NULL DEFAULT FALSE,
    source_code VARCHAR(64),
    market_code VARCHAR(64),
    priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    converted_reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_status ON waitlist_entries(hotel_id, status, requested_check_in);

CREATE TABLE IF NOT EXISTS group_allotments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    group_booking_id UUID NOT NULL REFERENCES group_bookings(id) ON DELETE CASCADE,
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    allotment_date DATE NOT NULL,
    contracted_rooms INTEGER NOT NULL DEFAULT 0,
    picked_up_rooms INTEGER NOT NULL DEFAULT 0,
    released_rooms INTEGER NOT NULL DEFAULT 0,
    washed_rooms INTEGER NOT NULL DEFAULT 0,
    rate_amount NUMERIC(14, 2),
    release_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_booking_id, room_type_id, allotment_date)
);

CREATE INDEX IF NOT EXISTS idx_group_allotments_group ON group_allotments(group_booking_id, allotment_date);

CREATE TABLE IF NOT EXISTS group_rooming_list_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    group_booking_id UUID NOT NULL REFERENCES group_bookings(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    guest_name VARCHAR(200) NOT NULL,
    guest_email VARCHAR(128),
    guest_phone VARCHAR(64),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    payment_responsibility VARCHAR(64),
    sharing_key VARCHAR(100),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    validation_errors TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_rooming_list_group ON group_rooming_list_entries(group_booking_id, status);

ALTER TABLE group_bookings
    ADD COLUMN IF NOT EXISTS release_date DATE,
    ADD COLUMN IF NOT EXISTS cutoff_date DATE,
    ADD COLUMN IF NOT EXISTS attrition_percent NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS attendee_booking_link_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS beo_required BOOLEAN NOT NULL DEFAULT FALSE;
