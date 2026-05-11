-- Guest service requests (mobile app / PWA in-stay requests)
CREATE TABLE service_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id),
    reservation_id  UUID REFERENCES reservations(id),
    guest_id        UUID REFERENCES guests(id),
    room_id         UUID REFERENCES rooms(id),
    request_type    VARCHAR(30) NOT NULL, -- EXTRA_TOWELS, ROOM_SERVICE, MAINTENANCE, WAKE_UP, LATE_CHECKOUT, OTHER
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    assigned_to     UUID REFERENCES app_users(id),
    priority        VARCHAR(10) NOT NULL DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_service_requests_hotel ON service_requests(hotel_id, status);
CREATE INDEX idx_service_requests_reservation ON service_requests(reservation_id);
