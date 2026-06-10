package com.hms.api;

import com.hms.api.dto.MobilePosDtos;
import com.hms.security.CheckModuleEntitlement;
import com.hms.security.PosStaffRoles;
import com.hms.service.PosOrderNotificationService;
import com.hms.service.PosTableTicketService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/pos")
@CheckModuleEntitlement("RESTAURANT_POS")
@RequiredArgsConstructor
public class MobilePosController {

    private final PosTableTicketService posTableTicketService;
    private final PosOrderNotificationService posOrderNotificationService;

    @GetMapping("/tables")
    @PreAuthorize(PosStaffRoles.ANY)
    public List<MobilePosDtos.PosTableRow> listTables(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return posTableTicketService.listTables(hotelId, hotelHeader, depotId, includeInactive);
    }

    @PostMapping("/tables")
    @PreAuthorize(PosStaffRoles.HOTEL_ADMIN)
    public ResponseEntity<MobilePosDtos.PosTableRow> createTable(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.CreatePosTableRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(posTableTicketService.createTable(hotelId, hotelHeader, body));
    }

    @PatchMapping("/tables/{tableId}")
    @PreAuthorize(PosStaffRoles.HOTEL_ADMIN)
    public MobilePosDtos.PosTableRow updateTable(
            @PathVariable UUID hotelId,
            @PathVariable UUID tableId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.UpdatePosTableRequest body) {
        return posTableTicketService.updateTable(hotelId, hotelHeader, tableId, body);
    }

    @DeleteMapping("/tables/{tableId}")
    @PreAuthorize(PosStaffRoles.HOTEL_ADMIN)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateTable(
            @PathVariable UUID hotelId,
            @PathVariable UUID tableId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        posTableTicketService.deactivateTable(hotelId, hotelHeader, tableId);
    }

    @GetMapping("/tickets")
    @PreAuthorize(PosStaffRoles.ANY)
    public List<MobilePosDtos.TicketRow> listTickets(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId,
            @RequestParam(defaultValue = "OPEN") String status) {
        return posTableTicketService.listTickets(hotelId, hotelHeader, depotId, status);
    }

    @GetMapping("/tickets/{ticketId}")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse getTicket(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.getTicket(hotelId, hotelHeader, ticketId);
    }

    @PostMapping("/tickets")
    @PreAuthorize(PosStaffRoles.ANY)
    public ResponseEntity<MobilePosDtos.TicketDetailResponse> createTicket(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.CreateTicketRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(posTableTicketService.createTicket(hotelId, hotelHeader, body));
    }

    @PostMapping("/tickets/{ticketId}/lines")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse addLines(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.AddTicketLinesRequest body) {
        return posTableTicketService.addLines(hotelId, hotelHeader, ticketId, body);
    }

    @PostMapping("/tickets/{ticketId}/send-to-kitchen")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse sendToKitchen(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.sendToKitchen(hotelId, hotelHeader, ticketId);
    }

    @PatchMapping("/tickets/{ticketId}/lines/{lineId}/ready")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse markLineReady(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @PathVariable UUID lineId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.markLineReady(hotelId, hotelHeader, lineId);
    }

    @PatchMapping("/tickets/{ticketId}/lines/{lineId}/served")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse markLineServed(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @PathVariable UUID lineId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.markLineServed(hotelId, hotelHeader, lineId);
    }

    @PostMapping("/tickets/{ticketId}/cancel")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse cancelTicket(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.cancelTicket(hotelId, hotelHeader, ticketId);
    }

    @PostMapping("/tickets/{ticketId}/close")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse closeTicket(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.CloseTicketRequest body) {
        return posTableTicketService.closeTicket(hotelId, hotelHeader, ticketId, body);
    }

    @GetMapping("/notifications")
    @PreAuthorize(PosStaffRoles.ANY)
    public List<MobilePosDtos.PosOrderNotificationRow> recentNotifications(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) Instant since) {
        return posOrderNotificationService.recent(hotelId, hotelHeader, since);
    }

    @GetMapping("/kitchen-board")
    @PreAuthorize(PosStaffRoles.ANY)
    public List<MobilePosDtos.KitchenTicketRow> kitchenBoard(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId) {
        return posTableTicketService.kitchenBoard(hotelId, hotelHeader, depotId);
    }

    @GetMapping("/daily-summary")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public MobilePosDtos.PosDailySummary dailySummary(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate date,
            @RequestParam(required = false) UUID depotId) {
        LocalDate day = date != null ? date : LocalDate.now();
        return posTableTicketService.dailySummary(hotelId, hotelHeader, day, depotId);
    }
}
