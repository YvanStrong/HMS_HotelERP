package com.hms.service;

import com.hms.domain.RoomStatus;
import com.hms.web.ApiException;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Set;
import org.springframework.http.HttpStatus;

/** Valid manual operational transitions (Phase 1 Step 3). */
public final class RoomStatusTransitions {

    private static final EnumMap<RoomStatus, Set<RoomStatus>> NEXT = new EnumMap<>(RoomStatus.class);

    static {
        NEXT.put(
                RoomStatus.VACANT_CLEAN,
                EnumSet.of(
                        RoomStatus.OCCUPIED,
                        RoomStatus.BLOCKED,
                        RoomStatus.OUT_OF_ORDER,
                        RoomStatus.UNDER_MAINTENANCE));
        NEXT.put(
                RoomStatus.VACANT_DIRTY,
                EnumSet.of(RoomStatus.VACANT_CLEAN, RoomStatus.UNDER_MAINTENANCE, RoomStatus.OUT_OF_ORDER));
        NEXT.put(RoomStatus.OCCUPIED, EnumSet.of(RoomStatus.VACANT_DIRTY, RoomStatus.BLOCKED));
        NEXT.put(
                RoomStatus.INSPECTED,
                EnumSet.of(RoomStatus.OCCUPIED, RoomStatus.BLOCKED, RoomStatus.UNDER_MAINTENANCE));
        NEXT.put(
                RoomStatus.BLOCKED,
                EnumSet.of(RoomStatus.VACANT_CLEAN, RoomStatus.INSPECTED, RoomStatus.VACANT_DIRTY));
        NEXT.put(RoomStatus.UNDER_MAINTENANCE, EnumSet.of(RoomStatus.VACANT_DIRTY));
        NEXT.put(RoomStatus.OUT_OF_ORDER, EnumSet.of(RoomStatus.VACANT_DIRTY, RoomStatus.UNDER_MAINTENANCE));
        NEXT.put(
                RoomStatus.RESERVED,
                EnumSet.of(RoomStatus.OCCUPIED, RoomStatus.BLOCKED, RoomStatus.VACANT_CLEAN, RoomStatus.VACANT_DIRTY));
    }

    private RoomStatusTransitions() {}

    public static void validate(RoomStatus from, RoomStatus to) {
        if (from == to) {
            return;
        }
        Set<RoomStatus> allowed = NEXT.get(from);
        if (allowed == null || !allowed.contains(to)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_ROOM_STATUS_TRANSITION",
                    "Cannot change room status from " + from + " to " + to);
        }
    }
}
