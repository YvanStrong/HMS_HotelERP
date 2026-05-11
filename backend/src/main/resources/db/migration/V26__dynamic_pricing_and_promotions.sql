-- Dynamic pricing rules engine
CREATE TABLE pricing_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id    UUID NOT NULL REFERENCES hotels(id),
    name        VARCHAR(100) NOT NULL,
    rule_type   VARCHAR(30)  NOT NULL,  -- OCCUPANCY_BRACKET, DAY_OF_WEEK, SEASON, EVENT
    conditions  TEXT,                    -- JSON: {"min_occupancy":80,"max_occupancy":95}
    multiplier  DECIMAL(5,3) NOT NULL DEFAULT 1.000, -- 1.200 = 20% markup
    priority    INT NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_rules_hotel ON pricing_rules(hotel_id);

-- Promotion / discount codes
CREATE TABLE promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id            UUID NOT NULL REFERENCES hotels(id),
    code                VARCHAR(30) NOT NULL,
    name                VARCHAR(100),
    discount_type       VARCHAR(20) NOT NULL, -- PERCENTAGE, FIXED_AMOUNT
    discount_value      DECIMAL(10,2) NOT NULL,
    valid_from          DATE,
    valid_until         DATE,
    usage_limit         INT,
    usage_count         INT NOT NULL DEFAULT 0,
    applicable_room_types TEXT,               -- comma-separated UUIDs (null = all)
    min_nights          INT NOT NULL DEFAULT 1,
    active              BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_promotions_hotel_code ON promotions(hotel_id, code);
