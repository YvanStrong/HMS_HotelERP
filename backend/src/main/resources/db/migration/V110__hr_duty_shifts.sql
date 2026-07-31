-- Hotel-wide duty / shift roster for ops accountability and coverage planning.
CREATE TABLE IF NOT EXISTS hr_duty_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    duty_date DATE NOT NULL,
    shift_code VARCHAR(32) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    department VARCHAR(120),
    location VARCHAR(120),
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    notes TEXT,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_hr_duty_shifts_status CHECK (
        status IN ('SCHEDULED', 'ON_DUTY', 'COMPLETED', 'ABSENT', 'CANCELLED', 'NO_SHOW')
    ),
    CONSTRAINT chk_hr_duty_shifts_shift CHECK (
        shift_code IN ('MORNING', 'AFTERNOON', 'NIGHT', 'CUSTOM')
    )
);

CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_hotel_date
    ON hr_duty_shifts (hotel_id, duty_date DESC);

CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_hotel_status
    ON hr_duty_shifts (hotel_id, status);

CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_hotel_shift
    ON hr_duty_shifts (hotel_id, shift_code);

CREATE INDEX IF NOT EXISTS idx_hr_duty_shifts_user_date
    ON hr_duty_shifts (user_id, duty_date DESC);
