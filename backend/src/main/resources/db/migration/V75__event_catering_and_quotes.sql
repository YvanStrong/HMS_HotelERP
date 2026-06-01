CREATE TABLE IF NOT EXISTS event_catering_package (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    package_name VARCHAR(200) NOT NULL,
    description TEXT,
    package_type VARCHAR(32) NOT NULL DEFAULT 'CUSTOM',
    price_per_pax NUMERIC(14, 2) NOT NULL DEFAULT 0,
    taxable BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_event_catering_package_type CHECK (
        package_type IN ('COFFEE_BREAK', 'BUFFET', 'COCKTAIL', 'SET_MENU', 'WEDDING', 'CUSTOM')
    )
);

CREATE INDEX IF NOT EXISTS idx_event_catering_package_hotel ON event_catering_package(hotel_id, active);

CREATE TABLE IF NOT EXISTS event_catering_line (
    id UUID PRIMARY KEY,
    event_booking_id UUID NOT NULL REFERENCES event_booking(id) ON DELETE CASCADE,
    catering_package_id UUID REFERENCES event_catering_package(id) ON DELETE SET NULL,
    depot_product_id UUID REFERENCES depot_products(id) ON DELETE SET NULL,
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    taxable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_catering_line_event ON event_catering_line(event_booking_id);

CREATE TABLE IF NOT EXISTS event_quote (
    id UUID PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    group_booking_id UUID NOT NULL REFERENCES group_bookings(id) ON DELETE CASCADE,
    event_booking_id UUID NOT NULL UNIQUE REFERENCES event_booking(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    deposit_required NUMERIC(14, 2) NOT NULL DEFAULT 0,
    deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
    valid_until DATE,
    internal_notes TEXT,
    client_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_event_quote_status CHECK (
        status IN ('DRAFT', 'SENT', 'ACCEPTED', 'CONTRACTED', 'CANCELLED')
    )
);

CREATE INDEX IF NOT EXISTS idx_event_quote_group ON event_quote(hotel_id, group_booking_id);

CREATE TABLE IF NOT EXISTS event_quote_line (
    id UUID PRIMARY KEY,
    event_quote_id UUID NOT NULL REFERENCES event_quote(id) ON DELETE CASCADE,
    line_type VARCHAR(32) NOT NULL DEFAULT 'OTHER',
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    taxable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_event_quote_line_type CHECK (
        line_type IN ('VENUE_RENTAL', 'CATERING', 'AV', 'DECOR', 'LABOR', 'OTHER')
    )
);

CREATE INDEX IF NOT EXISTS idx_event_quote_line_quote ON event_quote_line(event_quote_id);
