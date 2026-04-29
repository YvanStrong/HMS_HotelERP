package com.hms.domain;

/**
 * Operational room lifecycle (HMS Phase 1). Replaces legacy AVAILABLE / CHECKED_IN / CHECKED_OUT with
 * explicit housekeeping-ready states.
 */
public enum RoomStatus {
    VACANT_CLEAN,
    VACANT_DIRTY,
    OCCUPIED,
    INSPECTED,
    OUT_OF_ORDER,
    UNDER_MAINTENANCE,
    BLOCKED,
    RESERVED
}
