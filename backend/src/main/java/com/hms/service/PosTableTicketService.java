package com.hms.service;

import com.hms.api.dto.InventoryDepotDtos;
import com.hms.api.dto.MobilePosDtos;
import com.hms.domain.PosTableTicketStatus;
import com.hms.domain.PosTicketLineStatus;
import com.hms.domain.PosLineAuditAction;
import com.hms.entity.AppUser;
import com.hms.entity.DepotProduct;
import com.hms.entity.DepotSale;
import com.hms.entity.Hotel;
import com.hms.entity.InventoryDepot;
import com.hms.entity.PosDeliveryOrder;
import com.hms.entity.PosLineAudit;
import com.hms.entity.PosTable;
import com.hms.entity.PosTableTicket;
import com.hms.entity.PosTableTicketLine;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.entity.Guest;
import com.hms.domain.ReservationStatus;
import com.hms.domain.Role;
import com.hms.repository.ReservationRepository;
import com.hms.repository.AppUserRepository;
import com.hms.repository.DepotProductRepository;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.PosDeliveryOrderRepository;
import com.hms.repository.PosLineAuditRepository;
import com.hms.repository.PosTableRepository;
import com.hms.repository.PosTableTicketLineRepository;
import com.hms.repository.PosTableTicketRepository;
import com.hms.security.TenantAccessService;
import com.hms.service.folio.FolioTax;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PosTableTicketService {

    private static final List<PosTableTicketStatus> OPEN_STATUSES =
            List.of(PosTableTicketStatus.OPEN, PosTableTicketStatus.SENT_TO_KITCHEN, PosTableTicketStatus.SERVED);

    private static final List<PosTableTicketStatus> TRANSFERABLE_STATUSES =
            List.of(PosTableTicketStatus.OPEN, PosTableTicketStatus.SENT_TO_KITCHEN);

    private final TenantAccessService tenantAccessService;
    private final PosTableRepository posTableRepository;
    private final PosTableTicketRepository posTableTicketRepository;
    private final PosTableTicketLineRepository posTableTicketLineRepository;
    private final InventoryDepotRepository inventoryDepotRepository;
    private final DepotProductRepository depotProductRepository;
    private final HotelRepository hotelRepository;
    private final AppUserRepository appUserRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final PosDeliveryOrderRepository posDeliveryOrderRepository;
    private final InventoryDepotService inventoryDepotService;
    private final PosOrderNotificationService posOrderNotificationService;
    private final PosWebSocketPublisher posWebSocketPublisher;
    private final PushNotificationService pushNotificationService;
    private final PosShiftService posShiftService;
    private final PosPinAuthService posPinAuthService;
    private final PosLineAuditRepository posLineAuditRepository;
    private final ReservationRepository reservationRepository;

    @Transactional
    public List<MobilePosDtos.PosTableRow> listTables(
            UUID hotelId, String hotelHeader, UUID depotId, boolean includeInactive) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTable> tables;
        if (depotId != null) {
            ensureTablesBootstrapped(hotelId, depotId);
            tables = includeInactive
                    ? posTableRepository.findByHotel_IdAndDepot_IdOrderBySortOrderAsc(hotelId, depotId)
                    : posTableRepository.findByHotel_IdAndDepot_IdAndActiveTrueOrderBySortOrderAsc(hotelId, depotId);
        } else {
            tables = includeInactive
                    ? posTableRepository.findByHotel_IdOrderByDepotNameSortOrder(hotelId)
                    : posTableRepository.findByHotel_IdAndActiveTrueOrderByDepotNameSortOrder(hotelId);
        }
        return tables.stream().map(t -> toTableRow(hotelId, t)).toList();
    }

    @Transactional
    public MobilePosDtos.PosTableRow createTable(
            UUID hotelId, String hotelHeader, MobilePosDtos.CreatePosTableRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String label = req.label().trim();
        if (label.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TABLE_LABEL_REQUIRED", "Table label is required");
        }
        int capacity = req.capacity() != null ? req.capacity() : 4;
        if (capacity < 1 || capacity > 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CAPACITY", "Capacity must be between 1 and 20");
        }
        if (posTableRepository.existsByHotel_IdAndDepot_IdAndTableLabelIgnoreCase(hotelId, req.depotId(), label)) {
            throw new ApiException(HttpStatus.CONFLICT, "TABLE_EXISTS", "A table with this label already exists");
        }
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        int sortOrder = req.sortOrder() != null ? req.sortOrder() : (int) posTableRepository.countByDepot_Id(depot.getId()) + 1;
        PosTable table = new PosTable();
        table.setHotel(hotel);
        table.setDepot(depot);
        table.setTableLabel(label);
        table.setCapacity(capacity);
        table.setSortOrder(sortOrder);
        table.setActive(true);
        table = posTableRepository.save(table);
        return toTableRow(hotelId, table);
    }

    @Transactional
    public MobilePosDtos.PosTableRow updateTable(
            UUID hotelId, String hotelHeader, UUID tableId, MobilePosDtos.UpdatePosTableRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTable table = posTableRepository
                .findByIdAndHotel_Id(tableId, hotelId)
                .orElseThrow(() -> notFound("Table"));
        if (req.label() != null && !req.label().isBlank()) {
            String label = req.label().trim();
            if (!label.equalsIgnoreCase(table.getTableLabel())
                    && posTableRepository.existsByHotel_IdAndDepot_IdAndTableLabelIgnoreCase(
                            hotelId, table.getDepot().getId(), label)) {
                throw new ApiException(HttpStatus.CONFLICT, "TABLE_EXISTS", "A table with this label already exists");
            }
            table.setTableLabel(label);
        }
        if (req.capacity() != null) {
            if (req.capacity() < 1 || req.capacity() > 20) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CAPACITY", "Capacity must be between 1 and 20");
            }
            table.setCapacity(req.capacity());
        }
        if (req.sortOrder() != null) {
            table.setSortOrder(req.sortOrder());
        }
        if (req.isActive() != null && !req.isActive() && table.isActive()) {
            assertNoOpenTicketOnTable(hotelId, table.getId());
            table.setActive(false);
        } else if (req.isActive() != null) {
            table.setActive(req.isActive());
        }
        table = posTableRepository.save(table);
        return toTableRow(hotelId, table);
    }

    @Transactional
    public void deactivateTable(UUID hotelId, String hotelHeader, UUID tableId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTable table = posTableRepository
                .findByIdAndHotel_Id(tableId, hotelId)
                .orElseThrow(() -> notFound("Table"));
        assertNoOpenTicketOnTable(hotelId, table.getId());
        table.setActive(false);
        posTableRepository.save(table);
    }

    @Transactional(readOnly = true)
    public List<MobilePosDtos.TicketRow> listTickets(
            UUID hotelId, String hotelHeader, UUID depotId, String status) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicketStatus> statuses = parseStatuses(status);
        List<PosTableTicket> tickets = depotId != null
                ? posTableTicketRepository.findByHotel_IdAndDepot_IdAndStatusInOrderByUpdatedAtDesc(
                        hotelId, depotId, statuses)
                : posTableTicketRepository.findByHotel_IdAndStatusInOrderByUpdatedAtDesc(hotelId, statuses);
        return tickets.stream().map(this::toTicketRow).toList();
    }

    @Transactional(readOnly = true)
    public MobilePosDtos.TicketDetailResponse getTicket(UUID hotelId, String hotelHeader, UUID ticketId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        return toTicketDetail(ticket);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse createTicket(
            UUID hotelId, String hotelHeader, MobilePosDtos.CreateTicketRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String tableLabel = req.tableLabel().trim();

        assertTableAvailable(hotelId, depot.getId(), tableLabel);

        PosTableTicket ticket = new PosTableTicket();
        ticket.setHotel(hotel);
        ticket.setDepot(depot);
        ticket.setTableLabel(tableLabel);
        ticket.setCustomerName(req.customerName());
        ticket.setNotes(req.notes());
        if (req.guestCount() != null && req.guestCount() > 0) {
            ticket.setGuestCount(req.guestCount());
        }
        ticket.setStatus(PosTableTicketStatus.OPEN);
        AppUser staff = resolveCurrentStaff();
        ticket.setStaffUser(staff);
        if (staff != null) {
            posShiftService.findOpenShiftForWaiter(hotelId, staff.getId()).ifPresent(ticket::setShift);
        }

        if (req.tableId() != null) {
            posTableRepository
                    .findById(req.tableId())
                    .filter(t -> t.getHotel().getId().equals(hotelId) && t.getDepot().getId().equals(depot.getId()))
                    .ifPresent(ticket::setTable);
        }

        if (req.reservationId() != null) {
            linkReservation(ticket, hotelId, req.reservationId());
        } else if (req.tableId() != null) {
            final PosTableTicket ticketRef = ticket;
            findReservationForTable(hotel, req.tableId())
                    .ifPresent(res -> applyReservationToTicket(ticketRef, res, hotel));
        }

        List<MobilePosDtos.TicketLineInput> lines = req.lines() != null ? req.lines() : List.of();
        if (!lines.isEmpty()) {
            appendLines(ticket, hotel, depot.getId(), lines);
        } else {
            recalculateTotals(ticket);
        }

        ticket = posTableTicketRepository.save(ticket);
        publishTableStatus(ticket);
        return toTicketDetail(ticket);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse addLines(
            UUID hotelId, String hotelHeader, UUID ticketId, MobilePosDtos.AddTicketLinesRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        assertTicketEditable(ticket);
        if (req.lines() == null || req.lines().isEmpty()) {
            return toTicketDetail(ticket);
        }
        appendLines(ticket, ticket.getHotel(), ticket.getDepot().getId(), req.lines());
        ticket = posTableTicketRepository.save(ticket);
        ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticket.getId(), hotelId)
                .orElse(ticket);
        posOrderNotificationService.publishTicketItemsAdded(ticket);
        publishTableStatus(ticket);
        return toTicketDetail(ticket);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse sendToKitchen(
            UUID hotelId, String hotelHeader, UUID ticketId, MobilePosDtos.SendToKitchenRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        assertTicketEditable(ticket);
        if (ticket.getLines().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ticket has no lines");
        }

        boolean fireHeld = req != null && Boolean.TRUE.equals(req.fireHeld());
        Instant now = Instant.now();
        boolean anySent = sendReadyLinesToKitchen(ticket, now);
        if (fireHeld) {
            anySent = fireHeldPendingLines(ticket, now, null) || anySent;
        }
        if (!anySent) {
            throw new ApiException(HttpStatus.CONFLICT, "No pending lines to send");
        }

        ticket.setStatus(PosTableTicketStatus.SENT_TO_KITCHEN);
        if (ticket.getKitchenSentAt() == null) {
            ticket.setKitchenSentAt(now);
        }
        ticket = posTableTicketRepository.save(ticket);
        posOrderNotificationService.publishKitchenTicket(ticket);
        posWebSocketPublisher.publishKitchen(ticket.getHotel().getId(), toKitchenRow(ticket));
        publishTableStatus(ticket);
        return toTicketDetail(ticket);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse fireHeld(
            UUID hotelId, String hotelHeader, UUID ticketId, MobilePosDtos.FireHeldRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        assertTicketEditable(ticket);
        String course = req != null ? req.course() : null;
        Instant now = Instant.now();
        if (!fireHeldPendingLines(ticket, now, course)) {
            throw new ApiException(HttpStatus.CONFLICT, "No held lines to fire");
        }
        ticket.setStatus(PosTableTicketStatus.SENT_TO_KITCHEN);
        if (ticket.getKitchenSentAt() == null) {
            ticket.setKitchenSentAt(now);
        }
        ticket = posTableTicketRepository.save(ticket);
        posOrderNotificationService.publishKitchenTicket(ticket);
        posWebSocketPublisher.publishKitchen(ticket.getHotel().getId(), toKitchenRow(ticket));
        publishTableStatus(ticket);
        return toTicketDetail(ticket);
    }

    private boolean sendReadyLinesToKitchen(PosTableTicket ticket, Instant now) {
        boolean anySent = false;
        for (PosTableTicketLine line : ticket.getLines()) {
            if (line.getLineStatus() == PosTicketLineStatus.PENDING && !line.isHeld()) {
                line.setLineStatus(PosTicketLineStatus.PREPARING);
                line.setSentAt(now);
                anySent = true;
            }
        }
        return anySent;
    }

    private boolean fireHeldPendingLines(PosTableTicket ticket, Instant now, String courseFilter) {
        boolean anyFired = false;
        String course = courseFilter != null ? courseFilter.trim().toUpperCase(Locale.ROOT) : null;
        for (PosTableTicketLine line : ticket.getLines()) {
            if (!line.isHeld() || line.getLineStatus() != PosTicketLineStatus.PENDING) {
                continue;
            }
            if (course != null && !course.isBlank()) {
                if (line.getHoldCourse() == null || !line.getHoldCourse().name().equals(course)) {
                    continue;
                }
            }
            line.setHeld(false);
            line.setLineStatus(PosTicketLineStatus.PREPARING);
            line.setSentAt(now);
            anyFired = true;
        }
        return anyFired;
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse markLineReady(UUID hotelId, String hotelHeader, UUID lineId) {
        return transitionLine(hotelId, hotelHeader, lineId, PosTicketLineStatus.PREPARING, PosTicketLineStatus.READY);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse markLineServed(UUID hotelId, String hotelHeader, UUID lineId) {
        PosTableTicketLine line = posTableTicketLineRepository
                .findFetchedByIdAndHotelId(lineId, hotelId)
                .orElseThrow(() -> notFound("Line"));
        if (line.getLineStatus() != PosTicketLineStatus.READY) {
            throw new ApiException(HttpStatus.CONFLICT, "Line is not ready");
        }
        line.setLineStatus(PosTicketLineStatus.SERVED);
        line.setServedAt(Instant.now());
        PosTableTicket ticket = line.getTicket();
        boolean wasServed = ticket.getStatus() == PosTableTicketStatus.SERVED;
        boolean allServed = ticket.getLines().stream()
                .filter(PosTableTicketService::isBillableLine)
                .allMatch(l -> l.getLineStatus() == PosTicketLineStatus.SERVED);
        if (allServed) {
            ticket.setStatus(PosTableTicketStatus.SERVED);
        }
        ticket = posTableTicketRepository.save(ticket);
        publishLineEvent(ticket, line);
        posWebSocketPublisher.publishKitchen(ticket.getHotel().getId(), toKitchenRow(ticket));
        publishTableStatus(ticket);
        if (allServed && !wasServed) {
            posOrderNotificationService.publishTicketAllServed(ticket);
        }
        return toTicketDetail(ticket);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse cancelTicket(UUID hotelId, String hotelHeader, UUID ticketId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        if (ticket.getStatus() != PosTableTicketStatus.OPEN) {
            throw new ApiException(HttpStatus.CONFLICT, "Only open tickets can be cancelled");
        }
        ticket.setStatus(PosTableTicketStatus.CANCELLED);
        ticket.getLines().forEach(l -> l.setLineStatus(PosTicketLineStatus.CANCELLED));
        ticket = posTableTicketRepository.save(ticket);
        publishTableStatus(ticket);
        return toTicketDetail(ticket);
    }

    @Transactional(readOnly = true)
    public MobilePosDtos.ReservationHintResponse getTableReservationHint(
            UUID hotelId, String hotelHeader, UUID tableId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        PosTable table = posTableRepository
                .findByIdAndHotel_Id(tableId, hotelId)
                .orElseThrow(() -> notFound("Table"));
        return findReservationForTable(hotel, tableId)
                .map(res -> toReservationHint(res, hotel))
                .orElse(null);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse transferTicket(
            UUID hotelId, String hotelHeader, UUID ticketId, MobilePosDtos.TransferTicketRequest req, UUID requestedBy) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        if (!TRANSFERABLE_STATUSES.contains(ticket.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Ticket cannot be transferred in its current status");
        }
        PosTable newTable = posTableRepository
                .findByIdAndHotel_Id(req.newTableId(), hotelId)
                .orElseThrow(() -> notFound("Table"));
        if (!newTable.getDepot().getId().equals(ticket.getDepot().getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "New table must belong to the same outlet");
        }
        if (!newTable.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT, "TABLE_INACTIVE", "Table is not active");
        }
        posTableTicketRepository
                .findFirstByHotel_IdAndTable_IdAndStatusIn(hotelId, newTable.getId(), OPEN_STATUSES)
                .ifPresent(t -> {
                    throw new ApiException(HttpStatus.CONFLICT, "TABLE_OCCUPIED", "Table already has an active ticket");
                });

        String oldLabel = ticket.getTableLabel();
        UUID oldTableId = ticket.getTable() != null ? ticket.getTable().getId() : null;
        UUID depotId = ticket.getDepot().getId();

        ticket.setTable(newTable);
        ticket.setTableLabel(newTable.getTableLabel());

        AppUser actor = resolveUser(requestedBy);
        String actorName = staffDisplay(actor);
        appendTicketNote(
                ticket,
                String.format(
                        "[Transfer: Table %s → Table %s by %s at %s]",
                        oldLabel,
                        newTable.getTableLabel(),
                        actorName != null ? actorName : "Staff",
                        Instant.now()));

        ticket = posTableTicketRepository.save(ticket);
        publishTableAvailable(hotelId, depotId, oldTableId, oldLabel);
        publishTableStatus(ticket);
        return toTicketDetail(ticket);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse mergeTickets(
            UUID hotelId,
            String hotelHeader,
            UUID targetTicketId,
            MobilePosDtos.MergeTicketsRequest req,
            UUID requestedBy) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (targetTicketId.equals(req.sourceTicketId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot merge a ticket into itself");
        }
        PosTableTicket target = posTableTicketRepository
                .findFetchedByIdAndHotelId(targetTicketId, hotelId)
                .orElseThrow(() -> notFound("Target ticket"));
        PosTableTicket source = posTableTicketRepository
                .findFetchedByIdAndHotelId(req.sourceTicketId(), hotelId)
                .orElseThrow(() -> notFound("Source ticket"));
        if (!target.getDepot().getId().equals(source.getDepot().getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tickets must belong to the same outlet");
        }
        if (!TRANSFERABLE_STATUSES.contains(target.getStatus())
                || !TRANSFERABLE_STATUSES.contains(source.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Only open or kitchen-sent tickets can be merged");
        }

        int newRound = currentRound(target) + 1;
        int lineOrder =
                target.getLines().stream().mapToInt(PosTableTicketLine::getLineOrder).max().orElse(0) + 1;
        List<PosTableTicketLine> toMove = new ArrayList<>(source.getLines());
        for (PosTableTicketLine line : toMove) {
            source.getLines().remove(line);
            line.setTicket(target);
            line.setRound(newRound);
            line.setLineOrder(lineOrder++);
            target.getLines().add(line);
        }
        recalculateTotals(target);

        AppUser actor = resolveUser(requestedBy);
        String actorName = staffDisplay(actor);
        String sourceLabel = source.getTableLabel();
        UUID sourceTableId = source.getTable() != null ? source.getTable().getId() : null;
        UUID depotId = source.getDepot().getId();

        source.setStatus(PosTableTicketStatus.CANCELLED);
        appendTicketNote(
                source,
                String.format(
                        "[Merged into Ticket %s by %s]",
                        target.getId(),
                        actorName != null ? actorName : "Staff"));

        posTableTicketRepository.save(source);
        target = posTableTicketRepository.save(target);
        target = posTableTicketRepository
                .findFetchedByIdAndHotelId(target.getId(), hotelId)
                .orElse(target);

        publishTableAvailable(hotelId, depotId, sourceTableId, sourceLabel);
        publishTableStatus(target);
        return toTicketDetail(target);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse reassignTicket(
            UUID hotelId,
            String hotelHeader,
            UUID ticketId,
            MobilePosDtos.ReassignTicketRequest req,
            UUID requestedBy) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        if (ticket.getStatus() == PosTableTicketStatus.CLOSED
                || ticket.getStatus() == PosTableTicketStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "Closed tickets cannot be reassigned");
        }
        assertCanReassign(ticket, requestedBy, req.newWaiterUserId());

        AppUser oldWaiter = ticket.getStaffUser();
        AppUser newWaiter = appUserRepository
                .findByIdWithHotel(req.newWaiterUserId())
                .orElseThrow(() -> notFound("Waiter"));
        if (!newWaiter.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Waiter does not belong to this hotel");
        }

        String oldName = waiterDisplayForUser(oldWaiter);
        ticket.setStaffUser(newWaiter);
        appendTicketNote(
                ticket,
                String.format(
                        "[Handover: %s → %s at %s]",
                        oldName != null ? oldName : "—",
                        waiterDisplayForUser(newWaiter),
                        Instant.now()));

        ticket = posTableTicketRepository.save(ticket);
        publishTableStatus(ticket);
        return toTicketDetail(ticket);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse removePendingLine(
            UUID hotelId, String hotelHeader, UUID ticketId, UUID lineId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        assertTicketEditable(ticket);
        PosTableTicketLine line = findTicketLine(ticket, lineId);
        if (line.getLineStatus() != PosTicketLineStatus.PENDING) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "LINE_NOT_REMOVABLE",
                    "Only pending lines can be removed without manager approval");
        }
        ticket.getLines().remove(line);
        recalculateTotals(ticket);
        ticket = posTableTicketRepository.save(ticket);
        publishTableStatus(ticket);
        return toTicketDetail(
                posTableTicketRepository
                        .findFetchedByIdAndHotelId(ticket.getId(), hotelId)
                        .orElse(ticket));
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse voidLine(
            UUID hotelId,
            String hotelHeader,
            UUID ticketId,
            UUID lineId,
            MobilePosDtos.VoidLineRequest req,
            UUID requestedBy) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        assertTicketEditable(ticket);
        PosTableTicketLine line = findTicketLine(ticket, lineId);
        if (line.isVoided()) {
            throw new ApiException(HttpStatus.CONFLICT, "LINE_ALREADY_VOIDED", "Line is already voided");
        }
        AppUser authorizer = posPinAuthService.authorizeManagerPin(hotelId, req.managerPin());
        AppUser requester = resolveStaffUser(requestedBy);

        PosTicketLineStatus priorStatus = line.getLineStatus();
        BigDecimal originalUnitPrice = line.getUnitPrice();
        int originalQty = line.getQuantity().intValue();

        line.setVoided(true);
        line.setVoidReason(req.reason().trim());
        line.setEffectivePrice(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        line.setLineTotal(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        line.setLineStatus(PosTicketLineStatus.CANCELLED);

        recalculateTotals(ticket);
        ticket = posTableTicketRepository.save(ticket);
        saveAudit(
                ticket,
                line,
                PosLineAuditAction.VOID,
                originalUnitPrice,
                originalQty,
                null,
                null,
                req.reason().trim(),
                authorizer,
                requester);

        if (priorStatus == PosTicketLineStatus.PREPARING
                || priorStatus == PosTicketLineStatus.READY
                || priorStatus == PosTicketLineStatus.PENDING) {
            posWebSocketPublisher.publishKitchen(ticket.getHotel().getId(), toKitchenRow(ticket));
        }
        publishTableStatus(ticket);
        return toTicketDetail(
                posTableTicketRepository
                        .findFetchedByIdAndHotelId(ticket.getId(), hotelId)
                        .orElse(ticket));
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse applyLineDiscount(
            UUID hotelId,
            String hotelHeader,
            UUID ticketId,
            UUID lineId,
            MobilePosDtos.LineDiscountRequest req,
            UUID requestedBy) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        assertTicketEditable(ticket);
        PosTableTicketLine line = findTicketLine(ticket, lineId);
        if (line.isVoided()) {
            throw new ApiException(HttpStatus.CONFLICT, "LINE_ALREADY_VOIDED", "Cannot discount a voided line");
        }
        AppUser authorizer = posPinAuthService.authorizeManagerPin(hotelId, req.managerPin());
        AppUser requester = resolveStaffUser(requestedBy);

        BigDecimal originalUnitPrice = line.getUnitPrice();
        int originalQty = line.getQuantity().intValue();
        BigDecimal grossLine =
                originalUnitPrice.multiply(line.getQuantity()).setScale(2, RoundingMode.HALF_UP);

        String discountType = req.discountType().trim().toUpperCase(Locale.ROOT);
        BigDecimal discountAmount;
        BigDecimal discountPct = null;
        if ("PERCENT".equals(discountType)) {
            discountPct = req.discountValue().setScale(2, RoundingMode.HALF_UP);
            if (discountPct.compareTo(BigDecimal.ZERO) < 0 || discountPct.compareTo(new BigDecimal("100")) > 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid discount percentage");
            }
            discountAmount = grossLine.multiply(discountPct)
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        } else if ("AMOUNT".equals(discountType)) {
            discountAmount = req.discountValue().setScale(2, RoundingMode.HALF_UP);
            if (discountAmount.compareTo(BigDecimal.ZERO) < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid discount amount");
            }
            discountAmount = discountAmount.min(grossLine);
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "discountType must be PERCENT or AMOUNT");
        }

        BigDecimal netLine = grossLine.subtract(discountAmount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal effectiveUnit = line.getQuantity().signum() == 0
                ? BigDecimal.ZERO
                : netLine.divide(line.getQuantity(), 2, RoundingMode.HALF_UP);

        line.setDiscountPct(discountPct);
        line.setDiscountAmount(discountAmount);
        line.setEffectivePrice(effectiveUnit);
        line.setLineTotal(netLine);

        recalculateTotals(ticket);
        ticket = posTableTicketRepository.save(ticket);
        saveAudit(
                ticket,
                line,
                PosLineAuditAction.DISCOUNT,
                originalUnitPrice,
                originalQty,
                discountPct,
                discountAmount,
                req.reason().trim(),
                authorizer,
                requester);
        publishTableStatus(ticket);
        return toTicketDetail(
                posTableTicketRepository
                        .findFetchedByIdAndHotelId(ticket.getId(), hotelId)
                        .orElse(ticket));
    }

    @Transactional(readOnly = true)
    public List<MobilePosDtos.PosLineAuditRow> getLineAuditForTicket(
            UUID hotelId, String hotelHeader, UUID ticketId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        return posLineAuditRepository.findByTicketId(ticketId).stream().map(this::toAuditRow).toList();
    }

    @Transactional(readOnly = true)
    public Page<MobilePosDtos.PosLineAuditRow> getVoidReport(
            UUID hotelId, String hotelHeader, LocalDate from, LocalDate to, Pageable pageable) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ZoneId zone = ZoneId.systemDefault();
        Instant start = from.atStartOfDay(zone).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(zone).toInstant();
        return posLineAuditRepository
                .findByHotelIdAndCreatedAtBetween(hotelId, start, end, pageable)
                .map(this::toAuditRow);
    }

    @Transactional
    public MobilePosDtos.TicketDetailResponse closeTicket(
            UUID hotelId, String hotelHeader, UUID ticketId, MobilePosDtos.CloseTicketRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicket ticket = posTableTicketRepository
                .findFetchedByIdAndHotelId(ticketId, hotelId)
                .orElseThrow(() -> notFound("Ticket"));
        if (ticket.getLines().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ticket has no lines");
        }
        if (ticket.getStatus() == PosTableTicketStatus.CLOSED) {
            return toTicketDetail(ticket);
        }
        if (ticket.getStatus() == PosTableTicketStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "Ticket is cancelled");
        }

        String mode = req.mode().trim().toUpperCase(Locale.ROOT);
        List<InventoryDepotDtos.SaleLineInput> saleLines = ticket.getLines().stream()
                .filter(PosTableTicketService::isBillableLine)
                .map(l -> new InventoryDepotDtos.SaleLineInput(
                        l.getProduct().getId(),
                        l.getQuantity(),
                        l.getLineNotes(),
                        lineUnitPriceForSale(l)))
                .toList();
        if (saleLines.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No active lines on ticket");
        }

        UUID staffId = ticket.getStaffUser() != null ? ticket.getStaffUser().getId() : null;
        String customer = req.customerName() != null ? req.customerName() : ticket.getCustomerName();
        boolean chargeRoom = Boolean.TRUE.equals(req.chargeToRoom())
                || "CHARGE_ROOM".equals(mode)
                || "ROOM".equals(mode);

        if (chargeRoom && req.reservationId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "reservationId required for room charge");
        }

        if (isDeliveryCloseMode(mode)) {
            String paymentNote = deliveryPaymentNote(mode, req);
            String deliveryCustomer = deliveryCustomerLabel(customer, paymentNote, req.reservationId());
            InventoryDepotDtos.CreateDeliveryOrderResponse delivery = inventoryDepotService.createDeliveryOrder(
                    hotelId,
                    hotelHeader,
                    new InventoryDepotDtos.CreateDeliveryOrderRequest(
                            deliveryCustomer,
                            ticket.getTableLabel(),
                            ticket.getDepot().getId(),
                            saleLines,
                            staffId,
                            null));
            PosDeliveryOrder order = posDeliveryOrderRepository
                    .findById(delivery.deliveryOrderId())
                    .orElseThrow(() -> notFound("Delivery order"));
            ticket.setDeliveryOrder(order);
            ticket.setPaymentMethod(paymentNote);
        } else if (isInvoiceCloseMode(mode)) {
            String paymentMethod = resolveSalePaymentMethod(mode, req);
            InventoryDepotDtos.CreateSaleResponse saleRes = inventoryDepotService.createSale(
                    hotelId,
                    hotelHeader,
                    new InventoryDepotDtos.CreateSaleRequest(
                            customer,
                            null,
                            ticket.getDepot().getId(),
                            saleLines,
                            chargeRoom,
                            req.reservationId(),
                            paymentMethod,
                            ticket.getTableLabel(),
                            staffId,
                            null,
                            null,
                            null,
                            null));
            DepotSale sale = depotSaleRepository
                    .findById(saleRes.saleId())
                    .orElseThrow(() -> notFound("Sale"));
            ticket.setSale(sale);
            ticket.setPaymentMethod(paymentMethod);
            posOrderNotificationService.publishSale(sale);
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown close mode: " + mode);
        }

        BigDecimal tip = req.tipAmount() != null ? req.tipAmount() : BigDecimal.ZERO;
        if (tip.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tip cannot be negative");
        }
        tip = tip.setScale(2, RoundingMode.HALF_UP);
        ticket.setTipAmount(tip);
        if (tip.compareTo(BigDecimal.ZERO) > 0) {
            AppUser tipWaiter = ticket.getStaffUser() != null ? ticket.getStaffUser() : resolveCurrentStaff();
            ticket.setTipWaiter(tipWaiter);
        }

        AppUser shiftWaiter = ticket.getStaffUser() != null ? ticket.getStaffUser() : resolveCurrentStaff();
        if (ticket.getShift() == null && shiftWaiter != null) {
            posShiftService.findOpenShiftForWaiter(hotelId, shiftWaiter.getId()).ifPresent(ticket::setShift);
        }

        ticket.setStatus(PosTableTicketStatus.CLOSED);
        ticket.setClosedAt(Instant.now());
        ticket.getLines().stream()
                .filter(PosTableTicketService::isBillableLine)
                .forEach(l -> {
                    l.setLineStatus(PosTicketLineStatus.SERVED);
                    if (l.getServedAt() == null) {
                        l.setServedAt(Instant.now());
                    }
                });
        ticket = posTableTicketRepository.save(ticket);
        publishTableStatus(ticket);
        return toTicketDetail(
                posTableTicketRepository
                        .findFetchedByIdAndHotelId(ticket.getId(), hotelId)
                        .orElse(ticket));
    }

    @Transactional(readOnly = true)
    public List<MobilePosDtos.KitchenTicketRow> kitchenBoard(UUID hotelId, String hotelHeader, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTicketLineStatus> lineStatuses =
                List.of(PosTicketLineStatus.PENDING, PosTicketLineStatus.PREPARING, PosTicketLineStatus.READY);
        java.util.LinkedHashMap<UUID, PosTableTicket> tickets = new java.util.LinkedHashMap<>();
        for (PosTableTicketLine line :
                posTableTicketLineRepository.findKitchenLinesForHotel(hotelId, depotId, lineStatuses)) {
            tickets.putIfAbsent(line.getTicket().getId(), line.getTicket());
        }
        return tickets.values().stream()
                .sorted(Comparator.comparing(PosTableTicket::getUpdatedAt))
                .map(this::toKitchenRow)
                .toList();
    }

    private MobilePosDtos.TicketDetailResponse transitionLine(
            UUID hotelId,
            String hotelHeader,
            UUID lineId,
            PosTicketLineStatus expected,
            PosTicketLineStatus next) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosTableTicketLine line = posTableTicketLineRepository
                .findFetchedByIdAndHotelId(lineId, hotelId)
                .orElseThrow(() -> notFound("Line"));
        if (line.getLineStatus() != expected) {
            throw new ApiException(HttpStatus.CONFLICT, "Line status is " + line.getLineStatus());
        }
        line.setLineStatus(next);
        if (next == PosTicketLineStatus.READY) {
            line.setServedAt(null);
        }
        PosTableTicket ticket = line.getTicket();
        ticket = posTableTicketRepository.save(ticket);
        publishLineEvent(ticket, line);
        posWebSocketPublisher.publishKitchen(ticket.getHotel().getId(), toKitchenRow(ticket));
        if (next == PosTicketLineStatus.READY && ticket.getStaffUser() != null) {
            String productName = line.getProductName() != null
                    ? line.getProductName()
                    : line.getProduct().getProductName();
            Map<String, String> data = Map.of(
                    "type", "LINE_READY",
                    "ticketId", ticket.getId().toString(),
                    "lineId", line.getId().toString(),
                    "tableLabel", ticket.getTableLabel());
            pushNotificationService.sendToUser(
                    ticket.getStaffUser().getId(),
                    "Order Ready",
                    productName + " for " + ticket.getTableLabel() + " is ready to serve",
                    data);
        }
        return toTicketDetail(ticket);
    }

    @Transactional(readOnly = true)
    public MobilePosDtos.PosDailySummary dailySummary(
            UUID hotelId, String hotelHeader, LocalDate date, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ZoneId zone = ZoneId.systemDefault();
        Instant start = date.atStartOfDay(zone).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(zone).toInstant();

        List<PosTableTicket> closed = posTableTicketRepository.findClosedBetween(hotelId, start, end).stream()
                .filter(t -> depotId == null || t.getDepot().getId().equals(depotId))
                .toList();

        BigDecimal totalRevenue = closed.stream()
                .map(PosTableTicket::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int orderCount = closed.size();
        BigDecimal avgTicket = orderCount == 0
                ? BigDecimal.ZERO
                : totalRevenue.divide(BigDecimal.valueOf(orderCount), 2, RoundingMode.HALF_UP);

        Map<UUID, MobilePosDtos.DepotRevenueRow> depotMap = new LinkedHashMap<>();
        for (PosTableTicket t : closed) {
            UUID did = t.getDepot().getId();
            MobilePosDtos.DepotRevenueRow prev = depotMap.get(did);
            if (prev == null) {
                depotMap.put(
                        did,
                        new MobilePosDtos.DepotRevenueRow(did, t.getDepot().getName(), t.getTotalAmount(), 1));
            } else {
                depotMap.put(
                        did,
                        new MobilePosDtos.DepotRevenueRow(
                                did,
                                prev.depotName(),
                                prev.revenue().add(t.getTotalAmount()),
                                prev.orderCount() + 1));
            }
        }

        Map<String, Integer> itemQty = new HashMap<>();
        Map<String, BigDecimal> itemRev = new HashMap<>();
        for (PosTableTicket t : closed) {
            for (PosTableTicketLine line : t.getLines()) {
                if (line.getLineStatus() == PosTicketLineStatus.CANCELLED) {
                    continue;
                }
                String name = line.getProductName() != null
                        ? line.getProductName()
                        : line.getProduct().getProductName();
                itemQty.merge(name, line.getQuantity().intValue(), Integer::sum);
                itemRev.merge(name, line.getLineTotal(), BigDecimal::add);
            }
        }
        List<MobilePosDtos.TopItemRow> topItems = itemRev.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(e -> new MobilePosDtos.TopItemRow(
                        e.getKey(), itemQty.getOrDefault(e.getKey(), 0), e.getValue()))
                .toList();

        Map<UUID, List<PosTableTicket>> byWaiter = closed.stream()
                .filter(t -> t.getStaffUser() != null)
                .collect(Collectors.groupingBy(t -> t.getStaffUser().getId()));
        List<MobilePosDtos.WaiterStatRow> waiterStats = byWaiter.entrySet().stream()
                .map(e -> {
                    List<PosTableTicket> list = e.getValue();
                    BigDecimal rev = list.stream()
                            .map(PosTableTicket::getTotalAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    long avgMinutes = Math.round(list.stream()
                            .filter(t -> t.getOpenedAt() != null && t.getClosedAt() != null)
                            .mapToLong(t -> ChronoUnit.MINUTES.between(t.getOpenedAt(), t.getClosedAt()))
                            .average()
                            .orElse(0));
                    AppUser waiter = list.get(0).getStaffUser();
                    return new MobilePosDtos.WaiterStatRow(
                            e.getKey(), waiterDisplay(list.get(0)), list.size(), rev, avgMinutes);
                })
                .sorted(Comparator.comparing(MobilePosDtos.WaiterStatRow::revenue).reversed())
                .toList();

        long activeShifts = posShiftService.countOpenShifts(hotelId, depotId);
        long shiftCount = posShiftService.countShiftsClosedToday(hotelId, depotId, date);

        return new MobilePosDtos.PosDailySummary(
                totalRevenue,
                orderCount,
                avgTicket,
                new ArrayList<>(depotMap.values()),
                topItems,
                waiterStats,
                activeShifts,
                shiftCount);
    }

    private void appendLines(
            PosTableTicket ticket,
            Hotel hotel,
            UUID depotId,
            List<MobilePosDtos.TicketLineInput> inputs) {
        int round = posTableTicketLineRepository.maxRoundForTicket(ticket.getId()) + 1;
        if (ticket.getId() == null) {
            round = 1;
        }
        int lineOrder = ticket.getLines().size();
        for (MobilePosDtos.TicketLineInput line : inputs) {
            if (line.quantity() == null || line.quantity().signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be positive");
            }
            DepotProduct product = depotProductRepository
                    .findByIdAndHotel_Id(line.productId(), hotel.getId())
                    .orElseThrow(() -> notFound("Product"));
            if (!product.getDepot().getId().equals(depotId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product does not belong to depot");
            }
            BigDecimal unitPrice = product.getSellingPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unitPrice.multiply(line.quantity()).setScale(2, RoundingMode.HALF_UP);

            PosTableTicketLine tl = new PosTableTicketLine();
            tl.setTicket(ticket);
            tl.setProduct(product);
            tl.setProductName(product.getProductName());
            tl.setLineOrder(lineOrder++);
            tl.setRound(round);
            tl.setQuantity(line.quantity().setScale(3, RoundingMode.HALF_UP));
            tl.setUnitPrice(unitPrice);
            tl.setLineTotal(lineTotal);
            tl.setLineNotes(line.notes());
            tl.setTaxable(product.isTaxable());
            tl.setEffectivePrice(unitPrice);
            boolean held = Boolean.TRUE.equals(line.isHeld());
            tl.setHeld(held);
            if (held && line.holdCourse() != null && !line.holdCourse().isBlank()) {
                tl.setHoldCourse(parseHoldCourse(line.holdCourse()));
            }
            ticket.getLines().add(tl);
        }
        recalculateTotals(ticket);
    }

    private void recalculateTotals(PosTableTicket ticket) {
        BigDecimal subtotal = ticket.getLines().stream()
                .filter(PosTableTicketService::isBillableLine)
                .map(PosTableTicketLine::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taxable = ticket.getLines().stream()
                .filter(l -> isBillableLine(l) && l.isTaxable())
                .map(PosTableTicketLine::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = FolioTax.taxOnSubtotal(taxable, ticket.getHotel());
        ticket.setSubtotal(subtotal.setScale(2, RoundingMode.HALF_UP));
        ticket.setTaxAmount(tax);
        ticket.setTotalAmount(subtotal.add(tax).setScale(2, RoundingMode.HALF_UP));
    }

    private static boolean isBillableLine(PosTableTicketLine line) {
        return !line.isVoided() && line.getLineStatus() != PosTicketLineStatus.CANCELLED;
    }

    private static BigDecimal lineUnitPriceForSale(PosTableTicketLine line) {
        if (line.getEffectivePrice() != null) {
            return line.getEffectivePrice();
        }
        return line.getUnitPrice();
    }

    private PosTableTicketLine findTicketLine(PosTableTicket ticket, UUID lineId) {
        return ticket.getLines().stream()
                .filter(l -> l.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> notFound("Line"));
    }

    private AppUser resolveStaffUser(UUID userId) {
        if (userId == null) {
            return resolveCurrentStaff();
        }
        return appUserRepository.findByIdWithHotel(userId).orElseGet(this::resolveCurrentStaff);
    }

    private void saveAudit(
            PosTableTicket ticket,
            PosTableTicketLine line,
            PosLineAuditAction action,
            BigDecimal originalUnitPrice,
            int originalQty,
            BigDecimal discountPct,
            BigDecimal discountAmount,
            String reason,
            AppUser authorizer,
            AppUser requester) {
        PosLineAudit audit = new PosLineAudit();
        audit.setHotel(ticket.getHotel());
        audit.setTicket(ticket);
        audit.setLine(line);
        audit.setAction(action);
        audit.setOriginalPrice(originalUnitPrice.setScale(2, RoundingMode.HALF_UP));
        audit.setOriginalQty(originalQty);
        audit.setDiscountPct(discountPct);
        audit.setDiscountAmount(discountAmount);
        audit.setReason(reason);
        audit.setAuthorizedBy(authorizer);
        audit.setAuthorizedAt(Instant.now());
        audit.setCreatedBy(requester != null ? requester : authorizer);
        audit.setCreatedAt(Instant.now());
        posLineAuditRepository.save(audit);
    }

    private MobilePosDtos.PosLineAuditRow toAuditRow(PosLineAudit audit) {
        PosTableTicket ticket = audit.getTicket();
        PosTableTicketLine line = audit.getLine();
        String productName = line.getProductName() != null
                ? line.getProductName()
                : line.getProduct().getProductName();
        return new MobilePosDtos.PosLineAuditRow(
                audit.getId(),
                ticket.getId(),
                line.getId(),
                audit.getAction().name(),
                productName,
                ticket.getTableLabel(),
                waiterDisplay(ticket),
                audit.getOriginalPrice(),
                audit.getOriginalQty(),
                audit.getDiscountPct(),
                audit.getDiscountAmount(),
                audit.getReason(),
                audit.getAuthorizedBy().getId(),
                staffDisplay(audit.getAuthorizedBy()),
                audit.getCreatedBy().getId(),
                staffDisplay(audit.getCreatedBy()),
                audit.getCreatedAt());
    }

    private String staffDisplay(AppUser staff) {
        if (staff == null) {
            return null;
        }
        if (staff.getEmail() != null && !staff.getEmail().isBlank()) {
            return staff.getEmail();
        }
        return staff.getUsername();
    }

    private BigDecimal ticketDiscountTotal(PosTableTicket ticket) {
        return ticket.getLines().stream()
                .map(PosTableTicketLine::getDiscountAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private void assertTableAvailable(UUID hotelId, UUID depotId, String tableLabel) {
        if ("Counter".equalsIgnoreCase(tableLabel)) {
            return;
        }
        posTableTicketRepository
                .findFirstByHotel_IdAndDepot_IdAndTableLabelAndStatusIn(hotelId, depotId, tableLabel, OPEN_STATUSES)
                .ifPresent(t -> {
                    throw new ApiException(HttpStatus.CONFLICT, "TABLE_OCCUPIED", "Table already has an open ticket");
                });
    }

    private void assertTicketEditable(PosTableTicket ticket) {
        if (ticket.getStatus() == PosTableTicketStatus.CLOSED
                || ticket.getStatus() == PosTableTicketStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "TICKET_CLOSED", "Ticket is closed");
        }
    }

    private void ensureTablesBootstrapped(UUID hotelId, UUID depotId) {
        if (posTableRepository.countByDepot_Id(depotId) > 0) {
            return;
        }
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(depotId, hotelId)
                .orElseThrow(() -> notFound("Depot"));
        List<PosTable> batch = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            PosTable table = new PosTable();
            table.setHotel(hotel);
            table.setDepot(depot);
            table.setTableLabel("T" + i);
            table.setSortOrder(i);
            table.setActive(true);
            table.setCapacity(4);
            batch.add(table);
        }
        posTableRepository.saveAll(batch);
    }

    private void assertNoOpenTicketOnTable(UUID hotelId, UUID tableId) {
        posTableTicketRepository
                .findFirstByHotel_IdAndTable_IdAndStatusIn(hotelId, tableId, OPEN_STATUSES)
                .ifPresent(t -> {
                    throw new ApiException(
                            HttpStatus.CONFLICT,
                            "TABLE_HAS_ACTIVE_TICKET",
                            "Cannot deactivate table: active ticket exists");
                });
    }

    private MobilePosDtos.PosTableRow toTableRow(UUID hotelId, PosTable t) {
        Optional<PosTableTicket> active = activeTicketForTable(hotelId, t);
        return new MobilePosDtos.PosTableRow(
                t.getId(),
                t.getDepot().getId(),
                t.getDepot().getName(),
                t.getTableLabel(),
                t.getSortOrder(),
                t.getCapacity(),
                t.isActive(),
                active.isPresent(),
                active.map(PosTableTicket::getId).orElse(null),
                active.map(this::waiterDisplay).orElse(null));
    }

    private Optional<PosTableTicket> activeTicketForTable(UUID hotelId, PosTable t) {
        Optional<PosTableTicket> byId =
                posTableTicketRepository.findFirstByHotel_IdAndTable_IdAndStatusIn(hotelId, t.getId(), OPEN_STATUSES);
        if (byId.isPresent()) {
            return byId;
        }
        return posTableTicketRepository.findFirstByHotel_IdAndDepot_IdAndTableLabelAndStatusIn(
                hotelId, t.getDepot().getId(), t.getTableLabel(), OPEN_STATUSES);
    }

    private String waiterDisplay(PosTableTicket ticket) {
        AppUser staff = ticket.getStaffUser();
        if (staff == null) {
            return null;
        }
        if (staff.getEmail() != null && !staff.getEmail().isBlank()) {
            return staff.getEmail();
        }
        return staff.getUsername();
    }

    private int currentRound(PosTableTicket ticket) {
        return ticket.getLines().stream().mapToInt(PosTableTicketLine::getRound).max().orElse(0);
    }

    private void publishTableStatus(PosTableTicket ticket) {
        UUID tableId = ticket.getTable() != null ? ticket.getTable().getId() : null;
        boolean occupied = OPEN_STATUSES.contains(ticket.getStatus());
        posWebSocketPublisher.publishTables(
                ticket.getHotel().getId(),
                new MobilePosDtos.TableStatusEvent(
                        ticket.getDepot().getId(),
                        tableId,
                        ticket.getTableLabel(),
                        occupied,
                        occupied ? ticket.getId() : null));
    }

    private void publishLineEvent(PosTableTicket ticket, PosTableTicketLine line) {
        posWebSocketPublisher.publishLineReady(
                ticket.getHotel().getId(),
                new MobilePosDtos.LineReadyEvent(
                        ticket.getId(),
                        line.getId(),
                        ticket.getTableLabel(),
                        line.getProductName() != null ? line.getProductName() : line.getProduct().getProductName(),
                        line.getLineStatus(),
                        Instant.now()));
    }

    private MobilePosDtos.KitchenTicketRow toKitchenRow(PosTableTicket t) {
        List<MobilePosDtos.TicketLineRow> kitchenLines = t.getLines().stream()
                .filter(l -> {
                    if (l.isHeld() && l.getLineStatus() == PosTicketLineStatus.PENDING) {
                        return false;
                    }
                    return l.getLineStatus() == PosTicketLineStatus.PENDING
                            || l.getLineStatus() == PosTicketLineStatus.PREPARING
                            || l.getLineStatus() == PosTicketLineStatus.READY;
                })
                .map(this::toLineRow)
                .toList();
        return new MobilePosDtos.KitchenTicketRow(
                t.getId(),
                t.getTableLabel(),
                t.getDepot().getName(),
                t.getStatus(),
                t.getUpdatedAt(),
                kitchenLines);
    }

    private AppUser resolveCurrentStaff() {
        UUID userId = tenantAccessService.currentUser().getId();
        if (userId == null) {
            return null;
        }
        return appUserRepository.findByIdWithHotel(userId).orElse(null);
    }

    private List<PosTableTicketStatus> parseStatuses(String status) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            return List.of(PosTableTicketStatus.values());
        }
        return Arrays.stream(status.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> PosTableTicketStatus.valueOf(s.toUpperCase(Locale.ROOT)))
                .toList();
    }

    private MobilePosDtos.TicketRow toTicketRow(PosTableTicket t) {
        return new MobilePosDtos.TicketRow(
                t.getId(),
                t.getDepot().getId(),
                t.getDepot().getName(),
                t.getTable() != null ? t.getTable().getId() : null,
                t.getTableLabel(),
                t.getStatus(),
                t.getCustomerName(),
                t.getSubtotal(),
                t.getTaxAmount(),
                t.getTotalAmount(),
                t.getLines().size(),
                currentRound(t),
                t.getOpenedAt(),
                t.getKitchenSentAt(),
                t.getCreatedAt(),
                t.getUpdatedAt(),
                t.getSale() != null ? t.getSale().getId() : null,
                t.getSale() != null ? t.getSale().getSaleNumber() : null,
                t.getDeliveryOrder() != null ? t.getDeliveryOrder().getId() : null,
                t.getDeliveryOrder() != null ? t.getDeliveryOrder().getDeliveryNumber() : null,
                waiterDisplay(t));
    }

    private MobilePosDtos.TicketDetailResponse toTicketDetail(PosTableTicket t) {
        return new MobilePosDtos.TicketDetailResponse(
                t.getId(),
                t.getDepot().getId(),
                t.getDepot().getName(),
                t.getTable() != null ? t.getTable().getId() : null,
                t.getTableLabel(),
                t.getStatus(),
                t.getCustomerName(),
                t.getSubtotal(),
                t.getTaxAmount(),
                t.getTotalAmount(),
                currentRound(t),
                t.getOpenedAt(),
                t.getKitchenSentAt(),
                t.getClosedAt(),
                t.getCreatedAt(),
                t.getUpdatedAt(),
                t.getSale() != null ? t.getSale().getId() : null,
                t.getSale() != null ? t.getSale().getSaleNumber() : null,
                t.getDeliveryOrder() != null ? t.getDeliveryOrder().getId() : null,
                t.getDeliveryOrder() != null ? t.getDeliveryOrder().getDeliveryNumber() : null,
                waiterDisplay(t),
                ticketDiscountTotal(t),
                t.getGuestCount(),
                t.getReservation() != null ? t.getReservation().getId() : null,
                reservationRoomNumber(t.getReservation()),
                reservationDietaryNotes(t.getReservation()),
                t.getReservation() != null ? t.getReservation().getSpecialRequests() : null,
                reservationCheckInTime(t.getReservation(), t.getHotel()),
                t.getTipAmount() != null ? t.getTipAmount() : BigDecimal.ZERO,
                t.getLines().stream().sorted(Comparator.comparingInt(PosTableTicketLine::getRound)
                                .thenComparingInt(PosTableTicketLine::getLineOrder))
                        .map(this::toLineRow)
                        .toList());
    }

    private MobilePosDtos.TicketLineRow toLineRow(PosTableTicketLine l) {
        String name = l.getProductName() != null ? l.getProductName() : l.getProduct().getProductName();
        return new MobilePosDtos.TicketLineRow(
                l.getId(),
                l.getProduct().getId(),
                name,
                l.getQuantity(),
                l.getUnitPrice(),
                l.getLineTotal(),
                l.getLineNotes(),
                l.getLineStatus(),
                l.isTaxable(),
                l.getRound(),
                l.getSentAt(),
                l.getServedAt(),
                l.isVoided(),
                l.getVoidReason(),
                l.getDiscountPct(),
                l.getDiscountAmount(),
                l.getEffectivePrice(),
                l.getProduct() != null ? l.getProduct().getMenuName() : null,
                l.isHeld(),
                l.getHoldCourse() != null ? l.getHoldCourse().name() : null,
                productAllergens(l.getProduct()),
                productDietaryFlags(l.getProduct()));
    }

    private static List<String> productAllergens(DepotProduct product) {
        if (product == null || product.getInventoryItem() == null) {
            return List.of();
        }
        List<String> a = product.getInventoryItem().getAllergens();
        return a != null ? a : List.of();
    }

    private static List<String> productDietaryFlags(DepotProduct product) {
        if (product == null || product.getInventoryItem() == null) {
            return List.of();
        }
        List<String> d = product.getInventoryItem().getDietaryFlags();
        return d != null ? d : List.of();
    }

    private static com.hms.domain.PosHoldCourse parseHoldCourse(String raw) {
        try {
            return com.hms.domain.PosHoldCourse.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid hold course: " + raw);
        }
    }

    private static boolean isDeliveryCloseMode(String mode) {
        return "DELIVERY".equals(mode) || "BILL_LATER".equals(mode);
    }

    private static boolean isInvoiceCloseMode(String mode) {
        return "INVOICE".equals(mode)
                || "PAY_NOW".equals(mode)
                || "CASH".equals(mode)
                || "CARD".equals(mode)
                || "CHARGE_ROOM".equals(mode)
                || "ROOM".equals(mode);
    }

    private static String resolveSalePaymentMethod(String mode, MobilePosDtos.CloseTicketRequest req) {
        if ("CHARGE_ROOM".equals(mode) || "ROOM".equals(mode)) {
            return "ROOM";
        }
        if (req.paymentMethod() != null && !req.paymentMethod().isBlank()) {
            return req.paymentMethod().trim().toUpperCase(Locale.ROOT);
        }
        if ("CARD".equals(mode)) {
            return "CARD";
        }
        return "CASH";
    }

    private static String deliveryPaymentNote(String mode, MobilePosDtos.CloseTicketRequest req) {
        if ("CHARGE_ROOM".equals(mode) || "ROOM".equals(mode)) {
            return "Room";
        }
        if ("BILL_LATER".equals(mode) || "DELIVERY".equals(mode)) {
            return "Bill later";
        }
        if (req.paymentMethod() != null && !req.paymentMethod().isBlank()) {
            return req.paymentMethod().trim();
        }
        return "CARD".equals(mode) ? "Card" : "Cash";
    }

    private static String deliveryCustomerLabel(String customer, String paymentNote, UUID reservationId) {
        String base = customer != null && !customer.isBlank() ? customer.trim() : "Walk-in";
        String note = paymentNote + (reservationId != null ? " · res " + reservationId : "");
        return base + " (" + note + ")";
    }

    private void publishTableAvailable(UUID hotelId, UUID depotId, UUID tableId, String tableLabel) {
        posWebSocketPublisher.publishTables(
                hotelId,
                new MobilePosDtos.TableStatusEvent(depotId, tableId, tableLabel, false, null));
    }

    private void appendTicketNote(PosTableTicket ticket, String note) {
        String existing = ticket.getNotes();
        ticket.setNotes(existing == null || existing.isBlank() ? note : existing + "\n" + note);
    }

    private AppUser resolveUser(UUID userId) {
        if (userId == null) {
            return resolveCurrentStaff();
        }
        return appUserRepository.findByIdWithHotel(userId).orElse(null);
    }

    private String waiterDisplayForUser(AppUser staff) {
        if (staff == null) {
            return null;
        }
        if (staff.getEmail() != null && !staff.getEmail().isBlank()) {
            return staff.getEmail();
        }
        return staff.getUsername();
    }

    private void assertCanReassign(PosTableTicket ticket, UUID requestedBy, UUID newWaiterUserId) {
        if (requestedBy == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Authentication required");
        }
        if (newWaiterUserId.equals(requestedBy)) {
            return;
        }
        AppUser requester = appUserRepository
                .findByIdWithHotel(requestedBy)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "User not found"));
        Role role = requester.getRole();
        if (role == Role.HOTEL_ADMIN || role == Role.SUPER_ADMIN || role == Role.MANAGER) {
            return;
        }
        if (ticket.getStaffUser() != null && ticket.getStaffUser().getId().equals(requestedBy)) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed to reassign this ticket");
    }

    private void linkReservation(PosTableTicket ticket, UUID hotelId, UUID reservationId) {
        Reservation res = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> notFound("Reservation"));
        applyReservationToTicket(ticket, res, ticket.getHotel());
    }

    private void applyReservationToTicket(PosTableTicket ticket, Reservation res, Hotel hotel) {
        ticket.setReservation(res);
        Guest guest = res.getGuest();
        if (guest != null) {
            String name = guest.getFullName();
            if (name == null || name.isBlank()) {
                name = ((guest.getFirstName() != null ? guest.getFirstName() : "")
                                + " "
                                + (guest.getLastName() != null ? guest.getLastName() : ""))
                        .trim();
            }
            if (!name.isBlank()) {
                ticket.setCustomerName(name);
            }
        }
        if (res.getAdults() != null && res.getAdults() > 0) {
            ticket.setGuestCount(res.getAdults());
        }
    }

    private Optional<Reservation> findReservationForTable(Hotel hotel, UUID tableId) {
        PosTable table = posTableRepository
                .findByIdAndHotel_Id(tableId, hotel.getId())
                .orElse(null);
        if (table == null) {
            return Optional.empty();
        }
        LocalDate today = LocalDate.now(ZoneId.of(hotel.getTimezone()));
        List<ReservationStatus> statuses = List.of(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN);
        List<Reservation> stays =
                reservationRepository.findActiveStaysForHotel(hotel.getId(), today, statuses);
        String label = table.getTableLabel();
        for (Reservation res : stays) {
            if (reservationMatchesTable(res, tableId, label)) {
                return Optional.of(res);
            }
        }
        return findTimeWindowReservation(hotel, stays);
    }

    private boolean reservationMatchesTable(Reservation res, UUID tableId, String tableLabel) {
        String requests = res.getSpecialRequests();
        if (requests != null && !requests.isBlank()) {
            String lower = requests.toLowerCase(Locale.ROOT);
            if (lower.contains(tableId.toString().toLowerCase(Locale.ROOT))) {
                return true;
            }
            if (tableLabel != null && lower.contains(tableLabel.toLowerCase(Locale.ROOT))) {
                return true;
            }
            if (lower.contains("pos_table:" + tableLabel.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private Optional<Reservation> findTimeWindowReservation(Hotel hotel, List<Reservation> stays) {
        LocalDate today = LocalDate.now(ZoneId.of(hotel.getTimezone()));
        LocalTime now = LocalTime.now(ZoneId.of(hotel.getTimezone()));
        LocalTime checkIn = parseHotelCheckIn(hotel.getCheckInTime());
        for (Reservation res : stays) {
            if (!res.getCheckInDate().equals(today)) {
                continue;
            }
            if (reservationMatchesTable(res, null, null)) {
                continue;
            }
            long minutes = Math.abs(java.time.Duration.between(checkIn, now).toMinutes());
            if (minutes <= 30) {
                return Optional.of(res);
            }
        }
        return Optional.empty();
    }

    private LocalTime parseHotelCheckIn(String checkInTime) {
        if (checkInTime == null || checkInTime.isBlank()) {
            return LocalTime.of(14, 0);
        }
        try {
            return LocalTime.parse(checkInTime, DateTimeFormatter.ofPattern("HH:mm"));
        } catch (Exception e) {
            return LocalTime.of(14, 0);
        }
    }

    private MobilePosDtos.ReservationHintResponse toReservationHint(Reservation res, Hotel hotel) {
        Guest guest = res.getGuest();
        String guestName = guestName(guest);
        int guestCount = res.getAdults() != null ? res.getAdults() : 1;
        Room room = res.getRoom();
        String roomNumber = room != null ? room.getRoomNumber() : null;
        return new MobilePosDtos.ReservationHintResponse(
                res.getId(),
                guestName,
                guestCount,
                extractDietaryNotes(guest),
                roomNumber,
                reservationCheckInTime(res, hotel),
                res.getSpecialRequests());
    }

    private String guestName(Guest guest) {
        if (guest == null) {
            return "Guest";
        }
        if (guest.getFullName() != null && !guest.getFullName().isBlank()) {
            return guest.getFullName();
        }
        return ((guest.getFirstName() != null ? guest.getFirstName() : "")
                        + " " + (guest.getLastName() != null ? guest.getLastName() : ""))
                .trim();
    }

    private String extractDietaryNotes(Guest guest) {
        if (guest == null) {
            return null;
        }
        String prefs = guest.getPreferencesJson();
        if (prefs != null) {
            String lower = prefs.toLowerCase(Locale.ROOT);
            if (lower.contains("dietary") || lower.contains("allerg")) {
                return prefs.length() > 200 ? prefs.substring(0, 200) + "…" : prefs;
            }
        }
        return null;
    }

    private String reservationRoomNumber(Reservation res) {
        if (res == null || res.getRoom() == null) {
            return null;
        }
        return res.getRoom().getRoomNumber();
    }

    private String reservationDietaryNotes(Reservation res) {
        if (res == null) {
            return null;
        }
        return extractDietaryNotes(res.getGuest());
    }

    private String reservationCheckInTime(Reservation res, Hotel hotel) {
        if (res == null) {
            return null;
        }
        if (res.getActualCheckIn() != null) {
            return res.getActualCheckIn().toString();
        }
        String hotelCheckIn = hotel != null ? hotel.getCheckInTime() : null;
        return hotelCheckIn != null ? hotelCheckIn : "14:00";
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
