-- Channel manager: OTA connections & synchronisation
CREATE TABLE channel_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id),
    channel_code    VARCHAR(30) NOT NULL,  -- BOOKING_COM, EXPEDIA, AIRBNB, ICAL, GOOGLE
    status          VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED', -- CONNECTED, DISCONNECTED, ERROR
    credentials     TEXT,                  -- encrypted JSON: API keys per channel
    config          TEXT,                  -- JSON mapping: room_type_id → channel_room_id
    last_sync_at    TIMESTAMPTZ,
    sync_errors     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_conn_hotel ON channel_connections(hotel_id);

-- Rate plans pushed to external channels
CREATE TABLE channel_rate_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id       UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
    room_type_id        UUID NOT NULL REFERENCES room_types(id),
    channel_room_code   VARCHAR(50),
    rate_markup_pct     DECIMAL(5,2) NOT NULL DEFAULT 0,
    min_stay            INT NOT NULL DEFAULT 1,
    restrictions        TEXT,          -- JSON: closed_to_arrival, stop_sell, etc.
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_rate_conn ON channel_rate_plans(connection_id);

-- Sync activity log
CREATE TABLE channel_sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
    direction       VARCHAR(10) NOT NULL, -- PUSH, PULL
    payload_type    VARCHAR(30) NOT NULL, -- AVAILABILITY, RATE, RESERVATION
    status          VARCHAR(20) NOT NULL, -- SUCCESS, FAILURE
    details         TEXT,                 -- JSON: request/response summary
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_sync_conn_created ON channel_sync_log(connection_id, created_at DESC);
