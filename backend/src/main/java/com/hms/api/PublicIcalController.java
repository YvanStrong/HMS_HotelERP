package com.hms.api;

import com.hms.entity.Reservation;
import com.hms.repository.ReservationRepository;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

/**
 * Public iCal feed for OTA synchronization (Airbnb, VRBO, etc.)
 */
@RestController
@RequestMapping("/api/v1/public/hotels/{hotelId}/ical")
public class PublicIcalController {

    private final ReservationRepository reservationRepo;

    public PublicIcalController(ReservationRepository reservationRepo) {
        this.reservationRepo = reservationRepo;
    }

    @GetMapping(value = "/feed", produces = "text/calendar")
    public String getIcalFeed(@PathVariable UUID hotelId) {
        List<Reservation> bookings = reservationRepo.findByHotel_Id(hotelId);
        
        StringBuilder ics = new StringBuilder();
        ics.append("BEGIN:VCALENDAR\n");
        ics.append("VERSION:2.0\n");
        ics.append("PRODID:-//Ishyiga HMS//Channel Manager//EN\n");
        ics.append("CALSCALE:GREGORIAN\n");
        ics.append("METHOD:PUBLISH\n");

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

        for (Reservation res : bookings) {
            if ("CANCELLED".equals(res.getStatus())) continue;

            ics.append("BEGIN:VEVENT\n");
            ics.append("UID:").append(res.getId()).append("@ishyiga-hms.com\n");
            ics.append("DTSTAMP:").append(dtf.format(java.time.ZonedDateTime.now())).append("\n");
            ics.append("DTSTART;VALUE=DATE:").append(res.getCheckInDate().toString().replace("-", "")).append("\n");
            ics.append("DTEND;VALUE=DATE:").append(res.getCheckOutDate().toString().replace("-", "")).append("\n");
            ics.append("SUMMARY:Reserved (").append(res.getConfirmationCode()).append(")\n");
            ics.append("DESCRIPTION:Room ").append(res.getRoom() != null ? res.getRoom().getRoomNumber() : "TBD").append("\n");
            ics.append("STATUS:CONFIRMED\n");
            ics.append("END:VEVENT\n");
        }

        ics.append("END:VCALENDAR\n");
        return ics.toString();
    }
}
