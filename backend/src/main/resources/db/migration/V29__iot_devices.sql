-- IoT device registry for smart room integration
CREATE TABLE room_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id),
    room_id         UUID NOT NULL REFERENCES rooms(id),
    device_type     VARCHAR(30) NOT NULL,  -- THERMOSTAT, LOCK, LIGHT, CURTAIN, TV, MINIBAR_SENSOR, MOTION
    device_name     VARCHAR(100) NOT NULL,
    protocol        VARCHAR(20) NOT NULL DEFAULT 'REST', -- MQTT, REST, ZIGBEE, ZWAVE, MOCK
    endpoint        VARCHAR(255),          -- mqtt://broker/topic or https://device-ip/api
    auth_config     TEXT,                  -- encrypted JSON: credentials for device
    status          VARCHAR(20) NOT NULL DEFAULT 'OFFLINE', -- ONLINE, OFFLINE, ERROR
    last_heartbeat  TIMESTAMPTZ,
    metadata        TEXT,                  -- JSON: model, firmware, capabilities
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_devices_hotel ON room_devices(hotel_id);
CREATE INDEX idx_room_devices_room ON room_devices(room_id);

-- Device state change log
CREATE TABLE device_state_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID NOT NULL REFERENCES room_devices(id) ON DELETE CASCADE,
    state       TEXT NOT NULL,            -- JSON: {"temperature":22,"mode":"cool"}
    source      VARCHAR(20) NOT NULL,     -- GUEST, STAFF, AUTOMATION, SENSOR
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_state_device ON device_state_log(device_id, recorded_at DESC);

-- Energy / utility readings
CREATE TABLE energy_readings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id),
    room_id         UUID REFERENCES rooms(id),
    reading_type    VARCHAR(20) NOT NULL,  -- ELECTRICITY, WATER, GAS
    value           DECIMAL(12,3) NOT NULL,
    unit            VARCHAR(10) NOT NULL,  -- kWh, liters, m3
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_energy_hotel_date ON energy_readings(hotel_id, recorded_at DESC);
