-- API keys for machine-to-machine authentication (POS terminals, integrations)
CREATE TABLE api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id    UUID NOT NULL REFERENCES hotels(id),
    key_hash    VARCHAR(128) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    scopes      TEXT,           -- comma-separated: room:read,reservation:read
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hotel ON api_keys(hotel_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
