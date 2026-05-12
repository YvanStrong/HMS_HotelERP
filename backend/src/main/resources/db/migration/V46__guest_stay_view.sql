-- Read model for guest / stay analytics (reservations + guest profile + folio revenue snapshot).

CREATE OR REPLACE VIEW guest_stay AS
SELECT
    r.guest_id,
    r.hotel_id,
    r.id AS reservation_id,
    COALESCE(NULLIF(TRIM(g.nationality), ''), NULLIF(TRIM(g.country), ''), 'UNKNOWN') AS nationality,
    r.check_in_date AS check_in,
    r.check_out_date AS check_out,
    GREATEST(0, (r.check_out_date - r.check_in_date))::integer AS nights,
    CAST(r.status AS text) AS status,
    COALESCE(gf.total, r.total_amount, 0)::numeric(14, 2) AS stay_revenue,
    (COALESCE(upper(trim(g.vip_level)), 'NONE') <> 'NONE') AS vip_flag,
    (
        EXISTS (
            SELECT 1
            FROM reservations r0
            WHERE r0.guest_id = r.guest_id
              AND r0.hotel_id = r.hotel_id
              AND r0.check_in_date < r.check_in_date
              AND CAST(r0.status AS text) <> 'CANCELLED'
        )
    ) AS is_repeat,
    CAST(g.loyalty_tier AS text) AS loyalty_tier
FROM reservations r
JOIN guests g ON g.id = r.guest_id
LEFT JOIN guest_folio gf ON gf.reservation_id = r.id;

COMMENT ON VIEW guest_stay IS 'Per-reservation stay row for analytics: nationality, nights, status, folio revenue, VIP, repeat (prior non-cancelled stay).';
