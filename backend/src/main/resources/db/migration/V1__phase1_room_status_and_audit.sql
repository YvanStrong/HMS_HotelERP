-- Phase 1: migrate legacy room.status strings; add audit user id. Safe when tables are created later by JPA.

DO
$$
    BEGIN
        IF EXISTS (SELECT 1
                   FROM information_schema.tables
                   WHERE table_schema = 'public'
                     AND table_name = 'rooms') THEN
            UPDATE rooms SET status = 'VACANT_CLEAN' WHERE status = 'AVAILABLE';
            UPDATE rooms SET status = 'OCCUPIED' WHERE status = 'CHECKED_IN';
            UPDATE rooms SET status = 'VACANT_DIRTY' WHERE status = 'CHECKED_OUT';
        END IF;

        IF EXISTS (SELECT 1
                   FROM information_schema.tables
                   WHERE table_schema = 'public'
                     AND table_name = 'room_status_logs') THEN
            UPDATE room_status_logs
            SET previous_status = CASE previous_status
                                      WHEN 'AVAILABLE' THEN 'VACANT_CLEAN'
                                      WHEN 'CHECKED_IN' THEN 'OCCUPIED'
                                      WHEN 'CHECKED_OUT' THEN 'VACANT_DIRTY'
                                      ELSE previous_status END
            WHERE previous_status IN ('AVAILABLE', 'CHECKED_IN', 'CHECKED_OUT');

            UPDATE room_status_logs
            SET new_status = CASE new_status
                                 WHEN 'AVAILABLE' THEN 'VACANT_CLEAN'
                                 WHEN 'CHECKED_IN' THEN 'OCCUPIED'
                                 WHEN 'CHECKED_OUT' THEN 'VACANT_DIRTY'
                                 ELSE new_status END
            WHERE new_status IN ('AVAILABLE', 'CHECKED_IN', 'CHECKED_OUT');

            IF NOT EXISTS (SELECT 1
                           FROM information_schema.columns
                           WHERE table_schema = 'public'
                             AND table_name = 'room_status_logs'
                             AND column_name = 'changed_by_user_id') THEN
                ALTER TABLE room_status_logs ADD COLUMN changed_by_user_id UUID;
            END IF;
        END IF;
    END
$$;
