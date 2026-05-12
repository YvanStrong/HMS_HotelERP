-- Unified guest folio header + transaction ledger (mirrors room_charges / payments)

UPDATE hotels SET tax_rate = 0.18 WHERE tax_rate IS NULL OR tax_rate = 0;

CREATE TABLE IF NOT EXISTS guest_folio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    deposit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_folio_guest ON guest_folio(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_folio_status ON guest_folio(status);

CREATE TABLE IF NOT EXISTS folio_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES guest_folio(id) ON DELETE CASCADE,
    txn_type VARCHAR(20) NOT NULL,
    category VARCHAR(64),
    description TEXT,
    amount NUMERIC(14, 2) NOT NULL,
    debit_credit VARCHAR(10) NOT NULL,
    reference VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    room_charge_id UUID REFERENCES room_charges(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_folio_txn_folio ON folio_transactions(folio_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uk_folio_txn_room_charge ON folio_transactions(room_charge_id)
    WHERE room_charge_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_folio_txn_payment ON folio_transactions(payment_id)
    WHERE payment_id IS NOT NULL;

-- Backfill guest_folio snapshots (tax uses hotel tax_rate when between 0 and 1, else 0.18)
INSERT INTO guest_folio (
    id,
    reservation_id,
    guest_id,
    currency,
    subtotal,
    tax,
    discount,
    deposit,
    total,
    paid,
    balance,
    status,
    updated_at
)
SELECT
    gen_random_uuid(),
    r.id,
    r.guest_id,
    h.currency,
    round((coalesce(r.total_amount, 0) + coalesce(rc.extra_sum, 0))::numeric, 2) AS subtotal,
    round(
        (
            (coalesce(r.total_amount, 0) + coalesce(rc.extra_sum, 0))
            * CASE
                WHEN h.tax_rate IS NULL OR h.tax_rate <= 0 THEN 0.18
                WHEN h.tax_rate > 1 THEN (h.tax_rate / 100.0)
                ELSE h.tax_rate
            END
        )::numeric,
        2
    ) AS tax,
    0::numeric AS discount,
    CASE
        WHEN r.deposit_paid AND r.deposit_amount IS NOT NULL THEN round(r.deposit_amount::numeric, 2)
        ELSE 0::numeric
    END AS deposit,
    0::numeric,
    0::numeric,
    0::numeric,
    coalesce(r.folio_status, 'CLOSED'),
    now()
FROM reservations r
JOIN hotels h ON h.id = r.hotel_id
LEFT JOIN (
    SELECT reservation_id, sum(amount) AS extra_sum FROM room_charges GROUP BY reservation_id
) rc ON rc.reservation_id = r.id
WHERE NOT EXISTS (SELECT 1 FROM guest_folio gf WHERE gf.reservation_id = r.id);

UPDATE guest_folio gf
SET
    total = round((gf.subtotal + gf.tax - gf.discount)::numeric, 2),
    paid = round(
        (
            coalesce(
                (
                    SELECT sum(p.amount)
                    FROM payments p
                    WHERE p.reservation_id = gf.reservation_id AND upper(p.status) = 'COMPLETED'
                ),
                0
            ) + gf.deposit
        )::numeric,
        2
    ),
    balance = round(
        (
            (gf.subtotal + gf.tax - gf.discount)
            - (
                coalesce(
                    (
                        SELECT sum(p.amount)
                        FROM payments p
                        WHERE p.reservation_id = gf.reservation_id AND upper(p.status) = 'COMPLETED'
                    ),
                    0
                ) + gf.deposit
            )
        )::numeric,
        2
    ),
    status = coalesce((SELECT r2.folio_status FROM reservations r2 WHERE r2.id = gf.reservation_id), 'CLOSED'),
    updated_at = now();

-- Backfill folio_transactions from room_charges
INSERT INTO folio_transactions (
    id,
    folio_id,
    txn_type,
    category,
    description,
    amount,
    debit_credit,
    reference,
    created_at,
    room_charge_id,
    payment_id
)
SELECT
    gen_random_uuid(),
    gf.id,
    'CHARGE',
    cast(rc.charge_type as varchar),
    rc.description,
    round(rc.amount::numeric, 2),
    'DEBIT',
    rc.id::text,
    rc.charged_at,
    rc.id,
    NULL
FROM room_charges rc
JOIN guest_folio gf ON gf.reservation_id = rc.reservation_id
WHERE NOT EXISTS (SELECT 1 FROM folio_transactions ft WHERE ft.room_charge_id = rc.id);

-- Backfill folio_transactions from payments
INSERT INTO folio_transactions (
    id,
    folio_id,
    txn_type,
    category,
    description,
    amount,
    debit_credit,
    reference,
    created_at,
    room_charge_id,
    payment_id
)
SELECT
    gen_random_uuid(),
    gf.id,
    'PAYMENT',
    p.payment_type,
    coalesce(p.notes, p.payment_type || ' ' || p.method),
    round(p.amount::numeric, 2),
    'CREDIT',
    p.reference,
    p.processed_at,
    NULL,
    p.id
FROM payments p
JOIN guest_folio gf ON gf.reservation_id = p.reservation_id
WHERE upper(p.status) = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM folio_transactions ft WHERE ft.payment_id = p.id);
