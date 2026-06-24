package com.hms.api;

import com.hms.api.dto.MobilePosDtos;
import com.hms.api.dto.PosShiftDtos;
import com.hms.security.CheckModuleEntitlement;
import com.hms.security.PosStaffRoles;
import com.hms.security.TenantAccessService;
import com.hms.service.PosAnnouncementService;
import com.hms.service.PosOrderNotificationService;
import com.hms.service.PosShiftService;
import com.hms.service.PosTableTicketService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
    private final PosAnnouncementService posAnnouncementService;
    private final PosShiftService posShiftService;
    private final TenantAccessService tenantAccessService;

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

    @GetMapping("/tables/{tableId}/reservation-hint")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.ReservationHintResponse tableReservationHint(
            @PathVariable UUID hotelId,
            @PathVariable UUID tableId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.getTableReservationHint(hotelId, hotelHeader, tableId);
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
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) MobilePosDtos.SendToKitchenRequest body) {
        return posTableTicketService.sendToKitchen(hotelId, hotelHeader, ticketId, body);
    }

    @PostMapping("/tickets/{ticketId}/fire")
    @PreAuthorize(PosStaffRoles.WAITER)
    public MobilePosDtos.TicketDetailResponse fireHeld(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) MobilePosDtos.FireHeldRequest body) {
        return posTableTicketService.fireHeld(hotelId, hotelHeader, ticketId, body);
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

    @DeleteMapping("/tickets/{ticketId}/lines/{lineId}")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse removePendingLine(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @PathVariable UUID lineId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.removePendingLine(hotelId, hotelHeader, ticketId, lineId);
    }

    @PostMapping("/tickets/{ticketId}/lines/{lineId}/void")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse voidLine(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @PathVariable UUID lineId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.VoidLineRequest body) {
        UUID requester = tenantAccessService.currentUser().getId();
        return posTableTicketService.voidLine(hotelId, hotelHeader, ticketId, lineId, body, requester);
    }

    @PostMapping("/tickets/{ticketId}/lines/{lineId}/discount")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse applyLineDiscount(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @PathVariable UUID lineId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.LineDiscountRequest body) {
        UUID requester = tenantAccessService.currentUser().getId();
        return posTableTicketService.applyLineDiscount(hotelId, hotelHeader, ticketId, lineId, body, requester);
    }

    @GetMapping("/tickets/{ticketId}/audit")
    @PreAuthorize(PosStaffRoles.AUDIT_STAFF)
    public List<MobilePosDtos.PosLineAuditRow> ticketAudit(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.getLineAuditForTicket(hotelId, hotelHeader, ticketId);
    }

    @GetMapping("/voids")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public Page<MobilePosDtos.PosLineAuditRow> voidReport(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return posTableTicketService.getVoidReport(
                hotelId,
                hotelHeader,
                from,
                to,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    @PostMapping("/tickets/{ticketId}/cancel")
    @PreAuthorize(PosStaffRoles.ANY)
    public MobilePosDtos.TicketDetailResponse cancelTicket(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posTableTicketService.cancelTicket(hotelId, hotelHeader, ticketId);
    }

    @PostMapping("/tickets/{ticketId}/transfer")
    @PreAuthorize(PosStaffRoles.WAITER)
    public MobilePosDtos.TicketDetailResponse transferTicket(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.TransferTicketRequest body) {
        UUID requester = tenantAccessService.currentUser().getId();
        return posTableTicketService.transferTicket(hotelId, hotelHeader, ticketId, body, requester);
    }

    @PostMapping("/tickets/{ticketId}/merge")
    @PreAuthorize(PosStaffRoles.FNB_ADMIN)
    public MobilePosDtos.TicketDetailResponse mergeTickets(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.MergeTicketsRequest body) {
        UUID requester = tenantAccessService.currentUser().getId();
        return posTableTicketService.mergeTickets(hotelId, hotelHeader, ticketId, body, requester);
    }

    @PostMapping("/tickets/{ticketId}/reassign")
    @PreAuthorize(PosStaffRoles.WAITER)
    public MobilePosDtos.TicketDetailResponse reassignTicket(
            @PathVariable UUID hotelId,
            @PathVariable UUID ticketId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.ReassignTicketRequest body) {
        UUID requester = tenantAccessService.currentUser().getId();
        return posTableTicketService.reassignTicket(hotelId, hotelHeader, ticketId, body, requester);
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

    @PostMapping("/announcements")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public MobilePosDtos.AnnouncementRow createAnnouncement(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody MobilePosDtos.CreateAnnouncementRequest body) {
        return posAnnouncementService.create(hotelId, hotelHeader, body);
    }

    @GetMapping("/announcements/active")
    @PreAuthorize(PosStaffRoles.ANY)
    public List<MobilePosDtos.AnnouncementRow> activeAnnouncements(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId) {
        return posAnnouncementService.activeUnread(hotelId, hotelHeader, depotId);
    }

    @GetMapping("/announcements")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public List<MobilePosDtos.AnnouncementRow> listAnnouncements(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return posAnnouncementService.listActive(hotelId, hotelHeader);
    }

    @PostMapping("/announcements/{announcementId}/read")
    @PreAuthorize(PosStaffRoles.ANY)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAnnouncementRead(
            @PathVariable UUID hotelId,
            @PathVariable UUID announcementId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        posAnnouncementService.markRead(hotelId, hotelHeader, announcementId);
    }

    @DeleteMapping("/announcements/{announcementId}")
    @PreAuthorize(PosStaffRoles.MANAGER)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAnnouncement(
            @PathVariable UUID hotelId,
            @PathVariable UUID announcementId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        posAnnouncementService.deactivate(hotelId, hotelHeader, announcementId);
    }

    @GetMapping("/end-of-day")
    @PreAuthorize(PosStaffRoles.MANAGER)
    public PosShiftDtos.EndOfDayReport endOfDay(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        return posShiftService.endOfDay(hotelId, hotelHeader, day);
    }
}
