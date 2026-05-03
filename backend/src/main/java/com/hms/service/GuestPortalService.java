package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.Guest;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.entity.RoomType;
import com.hms.repository.GuestRepository;
import com.hms.repository.ReservationRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GuestPortalService {

    private final TenantAccessService tenantAccessService;
    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;

    public GuestPortalService(
            TenantAccessService tenantAccessService,
            GuestRepository guestRepository,
            ReservationRepository reservationRepository) {
        this.tenantAccessService = tenantAccessService;
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.GuestBookingRow> myBookings(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        Guest g = guestRepository
                .findByHotel_IdAndPortalAccount_Id(hotelId, userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "No guest profile linked to this account for this hotel — register on the booking site first."));
        List<Reservation> rows = reservationRepository.findByGuest_IdOrderByCheckInDateDesc(g.getId());
        return rows.stream().map(this::toGuestBookingRow).toList();
    }

    private ApiDtos.GuestBookingRow toGuestBookingRow(Reservation r) {
        String roomNo = "";
        String roomTypeName = "";
        List<String> merged = new ArrayList<>();
        Room room = r.getRoom();
        if (room != null) {
            roomNo = room.getRoomNumber();
            RoomType rt = room.getRoomType();
            if (rt != null) {
                roomTypeName = rt.getName();
                if (rt.getAmenities() != null) {
                    merged.addAll(rt.getAmenities());
                }
            }
            if (room.getAmenitiesOverride() != null && !room.getAmenitiesOverride().isBlank()) {
                for (String part : room.getAmenitiesOverride().split(",")) {
                    String t = part.trim();
                    if (!t.isEmpty()) {
                        merged.add(t);
                    }
                }
            }
        }
        String tz = r.getHotel().getTimezone() != null ? r.getHotel().getTimezone() : "UTC";
        String arrival = "Arrive on "
                + r.getCheckInDate()
                + " — standard check-in from 15:00 (hotel time: "
                + tz
                + "). Late arrival? Contact the front desk.";
        BigDecimal total = r.getTotalAmount();
        String currency = r.getHotel().getCurrency();
        return new ApiDtos.GuestBookingRow(
                r.getId(),
                r.getConfirmationCode(),
                r.getBookingReference(),
                r.getHotel().getName(),
                r.getStatus().name(),
                r.getCheckInDate(),
                r.getCheckOutDate(),
                roomNo,
                roomTypeName,
                r.isIncludesBreakfast(),
                r.getCancellationPolicy() != null ? r.getCancellationPolicy() : "",
                r.getSpecialRequests() != null ? r.getSpecialRequests() : "",
                arrival,
                List.copyOf(merged),
                total,
                currency);
    }
}
