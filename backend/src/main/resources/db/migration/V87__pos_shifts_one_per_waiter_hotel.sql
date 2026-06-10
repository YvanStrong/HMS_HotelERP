-- One open shift per waiter per hotel (all outlets share the same shift).
-- depot_id remains the outlet where the shift was started.

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY hotel_id, waiter_user_id ORDER BY opened_at ASC) AS rn
    FROM pos_shifts
    WHERE status = 'OPEN'
)
UPDATE pos_shifts s
SET status = 'CLOSED',
    closed_at = NOW(),
    closing_notes = COALESCE(s.closing_notes, '') || ' [Auto-closed: duplicate open shift merged by V87]'
WHERE s.id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_shifts_one_open_per_waiter
    ON pos_shifts(hotel_id, waiter_user_id)
    WHERE status = 'OPEN';
