package com.hms.service;

import com.hms.domain.CleanlinessStatus;
import com.hms.domain.ReservationStatus;
import com.hms.domain.RoomStatus;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import java.time.LocalDate;
import java.time.ZoneOffset;

/**
 * Maps physical {@link Room} + optional in-house {@link Reservation} to dashboard buckets aligned with
 * HMS Room Management spec (Occupied, Vacant-Clean, Vacant-Dirty, Inspected, OOO, Reserved, Blocked, Early check-in).
 */
public final class RoomOperationalState {

    public static final String OCCUPIED = "OCCUPIED";
    public static final String EARLY_CHECK_IN = "EARLY_CHECK_IN";
    public static final String VACANT_CLEAN = "VACANT_CLEAN";
    public static final String VACANT_DIRTY = "VACANT_DIRTY";
    public static final String INSPECTED_READY = "INSPECTED_READY";
    public static final String RESERVED = "RESERVED";
    public static final String BLOCKED = "BLOCKED";
    public static final String OUT_OF_ORDER = "OUT_OF_ORDER";
    public static final String INSPECTED = "INSPECTED";
    public static final String UNDER_MAINTENANCE = "UNDER_MAINTENANCE";

    private RoomOperationalState() {}

    public static String derive(Room room, Reservation inHouseReservation) {
        if (room.isOutOfOrder() || room.getStatus() == RoomStatus.OUT_OF_ORDER) {
            return OUT_OF_ORDER;
        }
        if (room.getStatus() == RoomStatus.BLOCKED) {
            return BLOCKED;
        }
        if (room.getStatus() == RoomStatus.OCCUPIED) {
            if (isEarlyCheckIn(inHouseReservation)) {
                return EARLY_CHECK_IN;
            }
            return OCCUPIED;
        }
        if (room.getStatus() == RoomStatus.RESERVED) {
            return RESERVED;
        }
        if (room.getStatus() == RoomStatus.VACANT_CLEAN) {
            return VACANT_CLEAN;
        }
        if (room.getStatus() == RoomStatus.VACANT_DIRTY) {
            return VACANT_DIRTY;
        }
        if (room.getStatus() == RoomStatus.INSPECTED) {
            return INSPECTED;
        }
        if (room.getStatus() == RoomStatus.UNDER_MAINTENANCE) {
            return UNDER_MAINTENANCE;
        }
        return room.getStatus().name();
    }

    private static boolean isEarlyCheckIn(Reservation res) {
        if (res == null || res.getStatus() != ReservationStatus.CHECKED_IN) {
            return false;
        }
        if (res.getActualCheckIn() == null) {
            return false;
        }
        LocalDate actual = res.getActualCheckIn().atZone(ZoneOffset.UTC).toLocalDate();
        return actual.isBefore(res.getCheckInDate());
    }
}
