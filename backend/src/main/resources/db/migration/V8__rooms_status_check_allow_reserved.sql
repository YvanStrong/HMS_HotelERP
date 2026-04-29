-- Fix booking 500: ReservationService sets room status to RESERVED on successful creation,
-- but some DBs still have an older rooms_status_check constraint that does not include RESERVED.
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;

ALTER TABLE rooms
    ADD CONSTRAINT rooms_status_check
        CHECK (
            status IN (
                       'VACANT_CLEAN',
                       'VACANT_DIRTY',
                       'OCCUPIED',
                       'INSPECTED',
                       'OUT_OF_ORDER',
                       'UNDER_MAINTENANCE',
                       'BLOCKED',
                       'RESERVED'
                )
            );
