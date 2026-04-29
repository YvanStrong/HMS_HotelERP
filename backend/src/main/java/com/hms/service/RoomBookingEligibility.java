package com.hms.service;

import com.hms.domain.RoomStatus;
import com.hms.entity.Room;

/**
 * Whether a physical room can be sold / assigned for a new stay. Aligns public offers and availability with
 * housekeeping reality: only rooms explicitly ready for sale ({@link RoomStatus#VACANT_CLEAN} or
 * {@link RoomStatus#INSPECTED}) are bookable.
 */
public final class RoomBookingEligibility {

    private RoomBookingEligibility() {}

    /** Vacant inventory that may receive a new confirmed reservation (before overlap / party checks). */
    public static boolean isVacantBookable(Room r) {
        if (r == null) {
            return false;
        }
        if (r.isOutOfOrder() || r.getStatus() == RoomStatus.OUT_OF_ORDER || r.getStatus() == RoomStatus.BLOCKED) {
            return false;
        }
        if (r.getStatus() == RoomStatus.RESERVED) {
            return false;
        }
        return r.getStatus() == RoomStatus.VACANT_CLEAN || r.getStatus() == RoomStatus.INSPECTED;
    }
}
