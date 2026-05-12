package com.hms.service;

import com.hms.domain.ChargeType;
import com.hms.domain.GroupBillingPreference;
import com.hms.domain.ReservationStatus;
import com.hms.entity.GroupBooking;
import com.hms.entity.Reservation;
import com.hms.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Routes folio {@link com.hms.entity.RoomCharge} rows to the reservation that owns the bill
 * (member vs master) based on group billing preference.
 */
@Service
public class GroupBillingRouter {

    /** Room tax, nightly room, and closely tied stay fees count as "accommodation / room" bucket. */
    public boolean isAccommodationBucket(ChargeType type) {
        return switch (type) {
            case ROOM_NIGHT, EARLY_CHECKIN, LATE_CHECKOUT, NO_SHOW -> true;
            default -> false;
        };
    }

    public boolean isIncidentalsBucket(ChargeType type) {
        return !isAccommodationBucket(type);
    }

    /**
     * Reservation whose guest folio should receive the charge row.
     *
     * @param originating the stay where the charge was triggered (member room, POS context, etc.)
     */
    public Reservation resolveFolioReservation(Reservation originating, ChargeType chargeType) {
        GroupBooking gb = originating.getGroupBooking();
        if (gb == null) {
            return originating;
        }
        GroupBillingPreference pref = GroupBillingPreference.parse(gb.getBillingPreference());
        if (pref == null) {
            return originating;
        }
        Reservation master = gb.getMasterReservation();
        if (master == null) {
            return originating;
        }
        if (!master.getHotel().getId().equals(originating.getHotel().getId())) {
            return originating;
        }
        assertMasterReadyForRouting(master);

        return switch (pref) {
            case MASTER_PAYS_ALL -> master;
            case SPLIT_BILLING, GUEST_PAYS_INCIDENTALS -> isAccommodationBucket(chargeType) ? master : originating;
        };
    }

    private static void assertMasterReadyForRouting(Reservation master) {
        if (master.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "GROUP_MASTER_NOT_CHECKED_IN",
                    "Master reservation must be CHECKED_IN before group charges can post to its folio.");
        }
    }

    public boolean requiresMasterFolioClearForMemberCheckout(Reservation member) {
        GroupBooking gb = member.getGroupBooking();
        if (gb == null) {
            return false;
        }
        Reservation master = gb.getMasterReservation();
        if (master == null || master.getId().equals(member.getId())) {
            return false;
        }
        GroupBillingPreference pref = GroupBillingPreference.parse(gb.getBillingPreference());
        return pref != null;
    }
}
