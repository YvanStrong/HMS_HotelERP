package com.hms.service;

import com.hms.domain.RoomStatus;
import com.hms.entity.Room;
import java.time.LocalDate;

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
        if (isHardUnavailable(r)) {
            return false;
        }
        if (r.getStatus() == RoomStatus.RESERVED) {
            return false;
        }
        return r.getStatus() == RoomStatus.VACANT_CLEAN || r.getStatus() == RoomStatus.INSPECTED;
    }

    /**
     * Whether the room may count toward date-range availability. Future stays ignore today's housekeeping
     * (dirty/occupied now) as long as there is no overlapping reservation or block on the requested dates.
     */
    public static boolean countsTowardStayAvailability(Room r, LocalDate stayCheckIn, LocalDate today) {
        if (r == null || isHardUnavailable(r)) {
            return false;
        }
        if (!stayCheckIn.isAfter(today)) {
            return isVacantBookable(r);
        }
        return r.getStatus() != RoomStatus.RESERVED;
    }

    private static boolean isHardUnavailable(Room r) {
        return r.isOutOfOrder()
                || r.getStatus() == RoomStatus.OUT_OF_ORDER
                || r.getStatus() == RoomStatus.BLOCKED
                || r.getStatus() == RoomStatus.UNDER_MAINTENANCE;
    }
}
