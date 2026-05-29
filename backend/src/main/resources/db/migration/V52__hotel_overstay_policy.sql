-- Hotel-specific late checkout / overstay policy.

ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS overstay_auto_post_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS overstay_grace_minutes INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS overstay_hourly_percent NUMERIC(5, 2) NOT NULL DEFAULT 1.50,
    ADD COLUMN IF NOT EXISTS overstay_half_day_cap_percent NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    ADD COLUMN IF NOT EXISTS overstay_full_day_after_hours INTEGER NOT NULL DEFAULT 6,
    ADD COLUMN IF NOT EXISTS overstay_max_daily_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    ADD COLUMN IF NOT EXISTS overstay_apply_tax BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS overstay_post_timing VARCHAR(32) NOT NULL DEFAULT 'AT_CHECKOUT';

ALTER TABLE hotels
    DROP CONSTRAINT IF EXISTS chk_hotels_overstay_post_timing,
    DROP CONSTRAINT IF EXISTS chk_hotels_overstay_non_negative;

ALTER TABLE hotels
    ADD CONSTRAINT chk_hotels_overstay_post_timing
        CHECK (overstay_post_timing IN ('AT_CHECKOUT', 'SCHEDULED_AUTO')),
    ADD CONSTRAINT chk_hotels_overstay_non_negative
        CHECK (
            overstay_grace_minutes >= 0
            AND overstay_hourly_percent >= 0
            AND overstay_half_day_cap_percent >= 0
            AND overstay_full_day_after_hours >= 1
            AND overstay_max_daily_percent >= 0
        );
