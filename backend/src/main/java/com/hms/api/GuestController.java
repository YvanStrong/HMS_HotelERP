package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.GuestDtos;
import com.hms.service.GuestService;
import com.hms.service.ReservationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/guests")
public class GuestController {

    private final GuestService guestService;
    private final ReservationService reservationService;

    public GuestController(GuestService guestService, ReservationService reservationService) {
        this.guestService = guestService;
        this.reservationService = reservationService;
    }

    @GetMapping("/_staff/complaint-log")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<GuestDtos.ComplaintBoardRow> complaintLog(
            @PathVariable UUID hotelId, @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.complaintBoard(hotelId, hotelHeader);
    }

    @GetMapping("/search")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE','ROLE_FNB_STAFF')")
    public List<GuestDtos.GuestSearchHit> searchGuests(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam String q) {
        return guestService.searchGuests(hotelId, hotelHeader, q);
    }

    @GetMapping
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE','ROLE_FNB_STAFF')")
    public List<GuestDtos.GuestSearchHit> listGuests(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.listGuests(hotelId, hotelHeader);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ResponseEntity<GuestDtos.GuestSearchHit> createGuest(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody ApiDtos.GuestInput body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(guestService.createGuestForStaff(hotelId, hotelHeader, body));
    }

    @PatchMapping("/{guestId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public GuestDtos.GuestSearchHit updateGuest(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody ApiDtos.GuestInput body) {
        return guestService.updateGuest(hotelId, hotelHeader, guestId, body);
    }

    @GetMapping("/{guestId}/reservations")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<ApiDtos.ReservationListItem> guestReservations(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String status) {
        return reservationService.listReservationsForGuest(hotelId, hotelHeader, guestId, status);
    }

    @GetMapping("/{guestId}/documents")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<GuestDtos.GuestDocumentRow> listDocuments(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.listDocuments(hotelId, hotelHeader, guestId);
    }

    @PostMapping("/{guestId}/documents")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public GuestDtos.GuestDocumentRow addDocument(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.GuestDocumentCreateRequest body) {
        return guestService.addDocument(hotelId, hotelHeader, guestId, body);
    }

    @DeleteMapping("/{guestId}/documents/{documentId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @PathVariable UUID documentId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        guestService.deleteDocument(hotelId, hotelHeader, guestId, documentId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{guestId}/communications")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public List<GuestDtos.GuestCommunicationRow> listCommunications(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.listCommunications(hotelId, hotelHeader, guestId);
    }

    @PostMapping("/{guestId}/communications")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public GuestDtos.GuestCommunicationRow logCommunication(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.GuestCommunicationCreateRequest body) {
        return guestService.logCommunication(hotelId, hotelHeader, guestId, body);
    }

    @GetMapping("/{guestId}/incidents")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<GuestDtos.SensitiveIncidentRow> listIncidents(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.listIncidents(hotelId, hotelHeader, guestId);
    }

    @PostMapping("/{guestId}/incidents")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public GuestDtos.SensitiveIncidentRow addIncident(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.SensitiveIncidentCreateRequest body) {
        return guestService.addIncident(hotelId, hotelHeader, guestId, body);
    }

    @PostMapping("/{guestId}/complaints")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public GuestDtos.ComplaintBoardRow logComplaint(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.GuestComplaintCreateRequest body) {
        return guestService.logComplaint(hotelId, hotelHeader, guestId, body);
    }

    @GetMapping("/{guestId}/profile")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public GuestDtos.GuestProfileResponse profile(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return guestService.profile(hotelId, hotelHeader, guestId);
    }

    @PostMapping("/{guestId}/loyalty/earn")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public GuestDtos.LoyaltyEarnResponse earn(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.LoyaltyEarnRequest body) {
        return guestService.earnLoyalty(hotelId, hotelHeader, guestId, body);
    }

    @PostMapping("/{guestId}/loyalty/redeem")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE','ROLE_GUEST')")
    public GuestDtos.LoyaltyRedeemResponse redeem(
            @PathVariable UUID hotelId,
            @PathVariable UUID guestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody GuestDtos.LoyaltyRedeemRequest body) {
        return guestService.redeemLoyalty(hotelId, hotelHeader, guestId, body);
    }

    @PostMapping("/merge")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<Void> mergeGuests(
            @PathVariable UUID hotelId,
            @RequestParam UUID sourceGuestId,
            @RequestParam UUID targetGuestId) {
        guestService.mergeGuests(hotelId, sourceGuestId, targetGuestId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/loyalty/recalculate")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<Void> recalculateLoyalty(@PathVariable UUID hotelId) {
        guestService.recalculateAllLoyalty(hotelId);
        return ResponseEntity.ok().build();
    }
}
