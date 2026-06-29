-- Repair: if V78 was wrongly applied as seed_super_admin locally, ensure real V78 schema exists.
ALTER TABLE group_bookings
    ADD COLUMN IF NOT EXISTS uses_room_block BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE room_charges
    ALTER COLUMN room_id DROP NOT NULL;

-- Default platform super admin (matches Postman Setup Initialize: username admin, password ChangeMe!Strong1).
-- Idempotent: skips insert when username already exists.

INSERT INTO app_users (
    id,
    username,
    email,
    password_hash,
    role,
    hotel_id,
    is_active,
    mfa_enabled,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'admin',
    CASE
        WHEN EXISTS (
            SELECT 1 FROM app_users WHERE lower(email) = lower('muhiregilbert27@gmail.com')
        ) THEN NULL
        ELSE 'muhiregilbert27@gmail.com'
    END,
    '$2a$10$IMKzoqZeglZdVXLlXUBDLepsB.ULEEwrx4ZhOlUe4wVsO1udwjFfm',
    'SUPER_ADMIN',
    NULL,
    true,
    false,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin');
