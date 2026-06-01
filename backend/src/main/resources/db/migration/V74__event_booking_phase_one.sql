CREATE TABLE IF NOT EXISTS event_booking (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    group_booking_id UUID NOT NULL REFERENCES group_bookings(id) ON DELETE CASCADE,
    event_name VARCHAR(200) NOT NULL,
    event_type VARCHAR(32) NOT NULL DEFAULT 'OTHER',
    status VARCHAR(32) NOT NULL DEFAULT 'TENTATIVE',
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    setup_style VARCHAR(80),
    expected_pax INTEGER,
    guaranteed_pax INTEGER,
    venue_or_facility_id UUID,
    coordinator_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_event_booking_type CHECK (event_type IN ('CONFERENCE', 'WEDDING', 'GALA', 'MEETING', 'OTHER')),
    CONSTRAINT chk_event_booking_status CHECK (status IN ('TENTATIVE', 'CONFIRMED', 'CANCELLED')),
    CONSTRAINT chk_event_booking_window CHECK (end_datetime > start_datetime),
    CONSTRAINT chk_event_booking_expected_pax CHECK (expected_pax IS NULL OR expected_pax >= 0),
    CONSTRAINT chk_event_booking_guaranteed_pax CHECK (guaranteed_pax IS NULL OR guaranteed_pax >= 0),
    CONSTRAINT chk_event_booking_pax_order CHECK (
        expected_pax IS NULL OR guaranteed_pax IS NULL OR guaranteed_pax <= expected_pax
    )
);

CREATE INDEX IF NOT EXISTS idx_event_booking_hotel_group
    ON event_booking(hotel_id, group_booking_id);

CREATE INDEX IF NOT EXISTS idx_event_booking_venue_window
    ON event_booking(hotel_id, venue_or_facility_id, start_datetime, end_datetime);
