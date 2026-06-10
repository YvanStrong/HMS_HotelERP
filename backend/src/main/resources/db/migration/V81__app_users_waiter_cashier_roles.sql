-- Mobile POS staff roles were added to Role.java but not to the DB check constraint.
ALTER TABLE app_users
    DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE app_users
    ADD CONSTRAINT app_users_role_check
    CHECK (
        role IN (
            'SUPER_ADMIN',
            'HOTEL_ADMIN',
            'RECEPTIONIST',
            'HOUSEKEEPING',
            'HOUSEKEEPING_SUPERVISOR',
            'MAINTENANCE',
            'FNB_STAFF',
            'WAITER',
            'CASHIER',
            'FINANCE',
            'MANAGER',
            'GUEST',
            'CORPORATE_BOOKER'
        )
    );
