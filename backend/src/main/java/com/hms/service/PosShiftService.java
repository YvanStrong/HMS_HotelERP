package com.hms.service;

import com.hms.api.dto.PosShiftDtos;
import com.hms.domain.PosTableTicketStatus;
import com.hms.domain.PosTicketLineStatus;
import com.hms.domain.Role;
import com.hms.domain.ShiftStatus;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.entity.InventoryDepot;
import com.hms.entity.PosShift;
import com.hms.entity.PosTableTicket;
import com.hms.entity.PosTableTicketLine;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.PosLineAuditRepository;
import com.hms.repository.PosShiftRepository;
import com.hms.repository.PosTableTicketRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import com.hms.web.PosShiftException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PosShiftService {

    private static final List<PosTableTicketStatus> OPEN_TICKET_STATUSES =
            List.of(PosTableTicketStatus.OPEN, PosTableTicketStatus.SENT_TO_KITCHEN, PosTableTicketStatus.SERVED);

    private final TenantAccessService tenantAccessService;
    private final PosShiftRepository posShiftRepository;
    private final PosTableTicketRepository posTableTicketRepository;
    private final AppUserRepository appUserRepository;
    private final HotelRepository hotelRepository;
    private final InventoryDepotRepository inventoryDepotRepository;
    private final PosLineAuditRepository posLineAuditRepository;

    @Transactional
    public PosShiftDtos.PosShiftDTO openShift(
            UUID hotelId, String hotelHeader, UUID depotId, UUID waiterUserId, PosShiftDtos.OpenShiftRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Optional<PosShift> existing = posShiftRepository.findOpenByHotelAndWaiter(hotelId, waiterUserId);
        if (existing.isPresent()) {
            return toShiftDto(existing.get(), liveSummary(existing.get()));
        }

        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(depotId, hotelId)
                .orElseThrow(() -> notFound("Depot"));
        AppUser waiter = appUserRepository
                .findByIdWithHotel(waiterUserId)
                .orElseThrow(() -> notFound("Waiter"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));

        BigDecimal openingFloat = scaleMoney(req.openingFloat() != null ? req.openingFloat() : BigDecimal.ZERO);

        PosShift shift = new PosShift();
        shift.setHotel(hotel);
        shift.setDepot(depot);
        shift.setWaiterUser(waiter);
        shift.setWaiterName(waiterDisplay(waiter));
        shift.setStatus(ShiftStatus.OPEN);
        shift.setOpeningFloat(openingFloat);
        shift.setOpenedAt(Instant.now());

        try {
            shift = posShiftRepository.save(shift);
            return toShiftDto(shift, SummaryCalc.empty());
        } catch (org.springframework.dao.DataIntegrityViolationException dup) {
            return posShiftRepository
                    .findOpenByHotelAndWaiter(hotelId, waiterUserId)
                    .map(s -> toShiftDto(s, liveSummary(s)))
                    .orElseThrow(() -> dup);
        }
    }

    @Transactional(readOnly = true)
    public Optional<PosShiftDtos.PosShiftDTO> getActiveShift(UUID hotelId, String hotelHeader, UUID waiterUserId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return posShiftRepository
                .findOpenByHotelAndWaiter(hotelId, waiterUserId)
                .map(s -> toShiftDto(s, liveSummary(s)));
    }

    @Transactional(readOnly = true)
    public PosShiftDtos.PosShiftSummaryDTO getShiftSummary(UUID hotelId, String hotelHeader, UUID shiftId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosShift shift = loadShift(hotelId, shiftId);
        assertShiftAccess(shift);
        return buildSummary(shift, calculateFromTickets(shift), false);
    }

    @Transactional(readOnly = true)
    public PosShiftDtos.PosShiftSummaryDTO getShift(UUID hotelId, String hotelHeader, UUID shiftId) {
        return getShiftSummary(hotelId, hotelHeader, shiftId);
    }

    @Transactional
    public PosShiftDtos.PosShiftSummaryDTO closeShift(
            UUID hotelId,
            String hotelHeader,
            UUID shiftId,
            PosShiftDtos.CloseShiftRequest req,
            UUID closedByUserId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosShift shift = loadShift(hotelId, shiftId);
        assertShiftCloseAccess(shift);

        if (shift.getStatus() != ShiftStatus.OPEN) {
            throw new ApiException(HttpStatus.CONFLICT, "SHIFT_ALREADY_CLOSED", "Shift is already closed");
        }

        List<PosTableTicket> openTickets =
                posTableTicketRepository.findByShift_IdAndStatusIn(shift.getId(), OPEN_TICKET_STATUSES);
        if (!openTickets.isEmpty()) {
            List<String> tables = openTickets.stream()
                    .map(t -> t.getDepot().getName() + " · " + t.getTableLabel())
                    .distinct()
                    .sorted()
                    .toList();
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("count", String.valueOf(tables.size()));
            fields.put("tables", String.join(", ", tables));
            throw new PosShiftException(
                    HttpStatus.CONFLICT,
                    "OPEN_TICKETS_EXIST",
                    "Cannot close shift: " + tables.size() + " table(s) still have open tickets. Close all tables first.",
                    fields);
        }

        attachOrphanTickets(shift);
        SummaryCalc calc = calculateFromTickets(shift);
        BigDecimal openingFloat = scaleMoney(nz(shift.getOpeningFloat()));
        BigDecimal cashSales = scaleMoney(calc.totalCash);
        BigDecimal expectedCash = openingFloat.add(cashSales);
        BigDecimal closingCash = scaleMoney(req.closingCash());
        BigDecimal cashVariance = closingCash.subtract(expectedCash).setScale(2, RoundingMode.HALF_UP);
        shift.setOpeningFloat(openingFloat);

        String notes = req.closingNotes();
        UserPrincipal closer = tenantAccessService.currentUser();
        if (isManagerRole(closer.getRole()) && !closer.getId().equals(shift.getWaiterUser().getId())) {
            AppUser closerUser = appUserRepository.findById(closedByUserId).orElse(null);
            String closerName = closerUser != null ? waiterDisplay(closerUser) : closer.getUsername();
            String prefix = "[Manager Close by " + closerName + "]: ";
            notes = notes != null && !notes.isBlank() ? prefix + notes : prefix.trim();
        }

        shift.setTotalOrders(calc.totalOrders);
        shift.setTotalCovers(calc.totalCovers);
        shift.setTotalCash(calc.totalCash);
        shift.setTotalCard(calc.totalCard);
        shift.setTotalRoomCharge(calc.totalRoomCharge);
        shift.setTotalRevenue(calc.totalRevenue);
        shift.setTotalTax(calc.totalTax);
        shift.setTotalTips(calc.totalTips);
        shift.setTotalCancelled(calc.totalCancelled);
        shift.setAvgTicketValue(calc.avgTicketValue);
        shift.setAvgServeTimeMin(calc.avgServeTimeMin);
        shift.setClosingCash(closingCash);
        shift.setCashVariance(cashVariance);
        shift.setClosingNotes(notes);
        shift.setStatus(ShiftStatus.CLOSED);
        shift.setClosedAt(Instant.now());
        if (closedByUserId != null) {
            appUserRepository.findById(closedByUserId).ifPresent(shift::setClosedBy);
        }

        shift = posShiftRepository.save(shift);
        return buildSummary(shift, calc, true);
    }

    @Transactional(readOnly = true)
    public Page<PosShiftDtos.PosShiftDTO> getShiftHistory(
            UUID hotelId,
            String hotelHeader,
            UUID depotId,
            UUID waiterUserId,
            LocalDate from,
            LocalDate to,
            ShiftStatus status,
            Pageable pageable) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ZoneId zone = ZoneId.systemDefault();
        Instant start = from.atStartOfDay(zone).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(zone).toInstant();
        return posShiftRepository
                .searchHistory(hotelId, depotId, waiterUserId, status, start, end, pageable)
                .map(s -> toShiftDto(s, s.getStatus() == ShiftStatus.OPEN ? liveSummary(s) : storedSummary(s)));
    }

    @Transactional(readOnly = true)
    public List<PosShiftDtos.PosShiftDTO> getAllOpenShifts(UUID hotelId, String hotelHeader, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosShift> shifts =
                depotId != null
                        ? posShiftRepository.findOpenByHotelAndDepot(hotelId, depotId)
                        : posShiftRepository.findOpenByHotel(hotelId);
        return shifts.stream().map(s -> toShiftDto(s, liveSummary(s))).toList();
    }

    @Transactional(readOnly = true)
    public long countOpenShifts(UUID hotelId, UUID depotId) {
        if (depotId != null) {
            return posShiftRepository.countByHotel_IdAndDepot_IdAndStatus(hotelId, depotId, ShiftStatus.OPEN);
        }
        return posShiftRepository.countByHotel_IdAndStatus(hotelId, ShiftStatus.OPEN);
    }

    @Transactional(readOnly = true)
    public long countShiftsClosedToday(UUID hotelId, UUID depotId, LocalDate day) {
        ZoneId zone = ZoneId.systemDefault();
        Instant start = day.atStartOfDay(zone).toInstant();
        Instant end = day.plusDays(1).atStartOfDay(zone).toInstant();
        return posShiftRepository.countClosedBetween(hotelId, depotId, start, end);
    }

    @Transactional(readOnly = true)
    public Optional<PosShift> findOpenShiftForWaiter(UUID hotelId, UUID waiterUserId) {
        return posShiftRepository.findOpenByHotelAndWaiter(hotelId, waiterUserId);
    }

    public String exportShiftCsv(PosShiftDtos.PosShiftSummaryDTO summary) {
        return String.join(
                ",",
                csv(summary.id()),
                csv(summary.waiterName()),
                csv(summary.depotName()),
                csv(summary.openedAt()),
                csv(summary.closedAt()),
                csv(summary.durationMinutes()),
                csv(summary.totalOrders()),
                csv(summary.totalCovers()),
                csv(summary.totalCancelled()),
                csv(summary.totalCash()),
                csv(summary.totalCard()),
                csv(summary.totalRoomCharge()),
                csv(summary.totalRevenue()),
                csv(summary.totalTax()),
                csv(summary.totalTips()),
                csv(summary.avgTicketValue()),
                csv(summary.avgServeTimeMin()),
                csv(summary.openingFloat()),
                csv(summary.expectedCash()),
                csv(summary.closingCash()),
                csv(summary.cashVariance()),
                csv(summary.cashVarianceStatus()),
                csv(summary.closingNotes()));
    }

    public String shiftCsvHeader() {
        return "shift_id,waiter_name,depot_name,opened_at,closed_at,duration_minutes,"
                + "total_orders,total_covers,total_cancelled,total_cash,total_card,total_room_charge,"
                + "total_revenue,total_tax,total_tips,avg_ticket_value,avg_serve_time_min,opening_float,"
                + "expected_cash,closing_cash,cash_variance,variance_status,closing_notes";
    }

    @Transactional(readOnly = true)
    public PosShiftDtos.EndOfDayReport endOfDay(UUID hotelId, String hotelHeader, LocalDate date) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ZoneId zone = ZoneId.systemDefault();
        Instant start = date.atStartOfDay(zone).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(zone).toInstant();

        List<PosShift> closedShifts = posShiftRepository.findClosedByHotelBetween(hotelId, start, end);
        BigDecimal totalCash = BigDecimal.ZERO;
        BigDecimal totalCard = BigDecimal.ZERO;
        BigDecimal totalRoom = BigDecimal.ZERO;
        BigDecimal totalTips = BigDecimal.ZERO;
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal expectedCashInDrawers = BigDecimal.ZERO;
        BigDecimal totalCashVariance = BigDecimal.ZERO;
        boolean hasShortage = false;
        boolean hasOverage = false;
        List<PosShiftDtos.EndOfDayShiftRow> perShift = new ArrayList<>();

        for (PosShift shift : closedShifts) {
            BigDecimal cash = scaleMoney(nz(shift.getTotalCash()));
            BigDecimal card = scaleMoney(nz(shift.getTotalCard()));
            BigDecimal room = scaleMoney(nz(shift.getTotalRoomCharge()));
            BigDecimal tips = scaleMoney(nz(shift.getTotalTips()));
            BigDecimal revenue = scaleMoney(nz(shift.getTotalRevenue()));
            BigDecimal opening = scaleMoney(nz(shift.getOpeningFloat()));
            BigDecimal variance = scaleMoney(nz(shift.getCashVariance()));
            String varStatus = varianceStatus(variance);
            if ("SHORTAGE".equals(varStatus)) {
                hasShortage = true;
            } else if ("OVERAGE".equals(varStatus)) {
                hasOverage = true;
            }
            totalCash = totalCash.add(cash);
            totalCard = totalCard.add(card);
            totalRoom = totalRoom.add(room);
            totalTips = totalTips.add(tips);
            totalRevenue = totalRevenue.add(revenue).add(tips);
            expectedCashInDrawers = expectedCashInDrawers.add(opening).add(cash);
            totalCashVariance = totalCashVariance.add(variance);
            perShift.add(new PosShiftDtos.EndOfDayShiftRow(
                    shift.getId(),
                    shift.getWaiterName(),
                    shift.getDepot().getName(),
                    opening,
                    shift.getClosingCash(),
                    variance,
                    varStatus,
                    cash,
                    card,
                    revenue.add(tips),
                    tips,
                    shift.getTotalOrders() != null ? shift.getTotalOrders() : 0));
        }

        BigDecimal totalDiscounts =
                scaleMoney(nz(posLineAuditRepository.sumDiscountAmountByHotelBetween(hotelId, start, end)));
        long totalVoids = posLineAuditRepository.countVoidsByHotelBetween(hotelId, start, end);
        long openShiftCount = posShiftRepository.countOpenByHotel(hotelId);
        String cashVarianceStatus = aggregateVarianceStatus(hasShortage, hasOverage);

        return new PosShiftDtos.EndOfDayReport(
                date,
                totalCash,
                totalCard,
                totalRoom,
                totalTips,
                totalRevenue,
                totalDiscounts,
                totalVoids,
                closedShifts.size(),
                openShiftCount,
                perShift,
                expectedCashInDrawers,
                totalCashVariance,
                cashVarianceStatus);
    }

    private static String aggregateVarianceStatus(boolean hasShortage, boolean hasOverage) {
        if (!hasShortage && !hasOverage) {
            return "BALANCED";
        }
        if (hasShortage && hasOverage) {
            return "MIXED";
        }
        return hasShortage ? "HAS_SHORTAGES" : "HAS_OVERAGES";
    }

    private static BigDecimal scaleMoney(BigDecimal value) {
        return nz(value).setScale(2, RoundingMode.HALF_UP);
    }

    private PosShift loadShift(UUID hotelId, UUID shiftId) {
        return posShiftRepository
                .findFetchedByIdAndHotelId(shiftId, hotelId)
                .orElseThrow(() -> notFound("Shift"));
    }

    private void assertShiftAccess(PosShift shift) {
        UserPrincipal user = tenantAccessService.currentUser();
        if (isManagerRole(user.getRole())) {
            return;
        }
        if (!user.getId().equals(shift.getWaiterUser().getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You can only view your own shifts");
        }
    }

    private void assertShiftCloseAccess(PosShift shift) {
        UserPrincipal user = tenantAccessService.currentUser();
        if (isManagerRole(user.getRole())) {
            return;
        }
        if (!user.getId().equals(shift.getWaiterUser().getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You can only close your own shift");
        }
    }

    private boolean isManagerRole(Role role) {
        return role == Role.SUPER_ADMIN || role == Role.HOTEL_ADMIN || role == Role.MANAGER;
    }

    private SummaryCalc liveSummary(PosShift shift) {
        if (shift.getStatus() == ShiftStatus.CLOSED) {
            return storedSummary(shift);
        }
        return calculateFromTickets(shift);
    }

    private SummaryCalc storedSummary(PosShift shift) {
        return new SummaryCalc(
                shift.getTotalOrders() != null ? shift.getTotalOrders() : 0,
                shift.getTotalCovers() != null ? shift.getTotalCovers() : 0,
                nz(shift.getTotalCash()),
                nz(shift.getTotalCard()),
                nz(shift.getTotalRoomCharge()),
                nz(shift.getTotalRevenue()),
                nz(shift.getTotalTax()),
                nz(shift.getTotalTips()),
                shift.getTotalCancelled() != null ? shift.getTotalCancelled() : 0,
                nz(shift.getAvgTicketValue()),
                nz(shift.getAvgServeTimeMin()),
                List.of(),
                List.of(),
                List.of());
    }

    /** Links closed tickets missing shift_id but belonging to this waiter during the shift window. */
    private void attachOrphanTickets(PosShift shift) {
        Instant until = shift.getClosedAt() != null ? shift.getClosedAt() : Instant.now();
        List<PosTableTicket> orphans = posTableTicketRepository.findOrphanClosedForWaiterSince(
                shift.getHotel().getId(), shift.getWaiterUser().getId(), shift.getOpenedAt(), until);
        for (PosTableTicket ticket : orphans) {
            ticket.setShift(shift);
            posTableTicketRepository.save(ticket);
        }
    }

    private List<PosTableTicket> ticketsForShift(PosShift shift) {
        List<PosTableTicket> tickets = new ArrayList<>(posTableTicketRepository.findFetchedByShiftId(shift.getId()));
        java.util.Set<UUID> seen = new java.util.HashSet<>();
        tickets.forEach(t -> seen.add(t.getId()));
        Instant until = shift.getClosedAt() != null ? shift.getClosedAt() : Instant.now();
        for (PosTableTicket orphan : posTableTicketRepository.findOrphanClosedForWaiterSince(
                shift.getHotel().getId(), shift.getWaiterUser().getId(), shift.getOpenedAt(), until)) {
            if (seen.add(orphan.getId())) {
                tickets.add(orphan);
            }
        }
        return tickets;
    }

    private SummaryCalc calculateFromTickets(PosShift shift) {
        List<PosTableTicket> allTickets = ticketsForShift(shift);
        List<PosTableTicket> closed = allTickets.stream()
                .filter(t -> t.getStatus() == PosTableTicketStatus.CLOSED)
                .toList();
        int totalCancelled = (int) allTickets.stream()
                .filter(t -> t.getStatus() == PosTableTicketStatus.CANCELLED)
                .count();

        BigDecimal totalCash = BigDecimal.ZERO;
        BigDecimal totalCard = BigDecimal.ZERO;
        BigDecimal totalRoom = BigDecimal.ZERO;
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        BigDecimal totalTips = BigDecimal.ZERO;
        int totalCovers = 0;

        for (PosTableTicket t : closed) {
            BigDecimal food = nz(t.getTotalAmount());
            BigDecimal tip = nz(t.getTipAmount());
            totalRevenue = totalRevenue.add(food);
            totalTax = totalTax.add(nz(t.getTaxAmount()));
            totalTips = totalTips.add(tip);
            totalCovers += t.getGuestCount();
            BigDecimal charged = food.add(tip);
            String pm = t.getPaymentMethod();
            if (isRoomPayment(pm)) {
                totalRoom = totalRoom.add(charged);
            } else if (isCardPayment(pm)) {
                totalCard = totalCard.add(charged);
            } else if (isCashPayment(pm)) {
                totalCash = totalCash.add(charged);
            } else if (isBillLaterPayment(pm)) {
                // Bill-later / delivery: counted in revenue, not in drawer
            }
        }

        int totalOrders = closed.size();
        BigDecimal avgTicket = totalOrders == 0
                ? BigDecimal.ZERO
                : totalRevenue.divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP);

        BigDecimal avgServe = BigDecimal.ZERO;
        if (!closed.isEmpty()) {
            double avgMin = closed.stream()
                    .filter(t -> t.getOpenedAt() != null && t.getClosedAt() != null)
                    .mapToLong(t -> ChronoUnit.MINUTES.between(t.getOpenedAt(), t.getClosedAt()))
                    .average()
                    .orElse(0);
            avgServe = BigDecimal.valueOf(avgMin).setScale(2, RoundingMode.HALF_UP);
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
        List<PosShiftDtos.ShiftTopItem> topItems = itemRev.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(e -> new PosShiftDtos.ShiftTopItem(
                        e.getKey(), itemQty.getOrDefault(e.getKey(), 0), e.getValue()))
                .toList();

        Map<UUID, PosShiftDtos.ShiftDepotRow> depotMap = new LinkedHashMap<>();
        for (PosTableTicket t : closed) {
            UUID did = t.getDepot().getId();
            String dname = t.getDepot().getName();
            BigDecimal amount = nz(t.getTotalAmount());
            BigDecimal tip = nz(t.getTipAmount());
            BigDecimal charged = amount.add(tip);
            BigDecimal cashPart = isCashPayment(t.getPaymentMethod()) ? charged : BigDecimal.ZERO;
            PosShiftDtos.ShiftDepotRow prev = depotMap.get(did);
            if (prev == null) {
                depotMap.put(did, new PosShiftDtos.ShiftDepotRow(did, dname, 1, amount, cashPart));
            } else {
                depotMap.put(
                        did,
                        new PosShiftDtos.ShiftDepotRow(
                                did,
                                dname,
                                prev.orderCount() + 1,
                                prev.revenue().add(amount),
                                prev.cash().add(cashPart)));
            }
        }
        List<PosShiftDtos.ShiftDepotRow> revenueByDepot = new ArrayList<>(depotMap.values());

        List<PosShiftDtos.ShiftTicketSummary> ticketSummaries = closed.stream()
                .sorted(Comparator.comparing(PosTableTicket::getClosedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(t -> new PosShiftDtos.ShiftTicketSummary(
                        t.getId(),
                        t.getDepot().getName(),
                        t.getTableLabel(),
                        t.getClosedAt(),
                        t.getTotalAmount(),
                        t.getPaymentMethod(),
                        (int) t.getLines().stream()
                                .filter(l -> l.getLineStatus() != PosTicketLineStatus.CANCELLED)
                                .count()))
                .toList();

        return new SummaryCalc(
                totalOrders,
                totalCovers,
                totalCash,
                totalCard,
                totalRoom,
                totalRevenue,
                totalTax,
                totalTips,
                totalCancelled,
                avgTicket,
                avgServe,
                topItems,
                revenueByDepot,
                ticketSummaries);
    }

    private PosShiftDtos.PosShiftSummaryDTO buildSummary(PosShift shift, SummaryCalc calc, boolean includeClosing) {
        PosShiftDtos.PosShiftDTO base = toShiftDto(shift, calc);
        BigDecimal expectedCash = scaleMoney(nz(shift.getOpeningFloat())).add(scaleMoney(calc.totalCash));
        BigDecimal closingCash = includeClosing ? shift.getClosingCash() : null;
        BigDecimal cashVariance = includeClosing ? shift.getCashVariance() : null;
        String varianceStatus = varianceStatus(cashVariance);
        BigDecimal totalDiscounts = nz(posLineAuditRepository.sumDiscountAmountByShiftId(shift.getId()));
        return new PosShiftDtos.PosShiftSummaryDTO(
                base.id(),
                base.hotelId(),
                base.depotId(),
                base.depotName(),
                base.waiterUserId(),
                base.waiterName(),
                base.status(),
                base.openedAt(),
                base.closedAt(),
                base.openingFloat(),
                base.totalOrders(),
                base.totalRevenue(),
                base.durationMinutes(),
                calc.totalCovers,
                calc.totalCash,
                calc.totalCard,
                calc.totalRoomCharge,
                calc.totalTax,
                calc.totalTips,
                calc.totalCancelled,
                totalDiscounts,
                calc.avgTicketValue,
                calc.avgServeTimeMin,
                expectedCash,
                closingCash,
                cashVariance,
                shift.getClosingNotes(),
                varianceStatus,
                calc.topItems,
                calc.revenueByDepot,
                calc.tickets);
    }

    private PosShiftDtos.PosShiftDTO toShiftDto(PosShift shift, SummaryCalc calc) {
        Instant end = shift.getClosedAt() != null ? shift.getClosedAt() : Instant.now();
        long duration = ChronoUnit.MINUTES.between(shift.getOpenedAt(), end);
        BigDecimal storedVariance = shift.getStatus() == ShiftStatus.CLOSED ? shift.getCashVariance() : null;
        return new PosShiftDtos.PosShiftDTO(
                shift.getId(),
                shift.getHotel().getId(),
                shift.getDepot().getId(),
                shift.getDepot().getName(),
                shift.getWaiterUser().getId(),
                shift.getWaiterName(),
                shift.getStatus(),
                shift.getOpenedAt(),
                shift.getClosedAt(),
                shift.getOpeningFloat(),
                calc.totalOrders,
                calc.totalRevenue,
                duration,
                storedVariance,
                varianceStatus(storedVariance));
    }

    private static String varianceStatus(BigDecimal variance) {
        if (variance == null) {
            return null;
        }
        int cmp = variance.compareTo(BigDecimal.ZERO);
        if (cmp == 0) {
            return "BALANCED";
        }
        return cmp > 0 ? "OVERAGE" : "SHORTAGE";
    }

    private static boolean isCashPayment(String pm) {
        if (pm == null || pm.isBlank()) {
            return false;
        }
        String u = pm.toUpperCase(Locale.ROOT);
        return u.contains("CASH") || "CASH".equals(u);
    }

    private static boolean isCardPayment(String pm) {
        if (pm == null || pm.isBlank()) {
            return false;
        }
        String u = pm.toUpperCase(Locale.ROOT);
        return u.contains("CARD") || u.contains("VISA") || u.contains("MOMO") || u.contains("MPESA");
    }

    private static boolean isRoomPayment(String pm) {
        if (pm == null || pm.isBlank()) {
            return false;
        }
        String u = pm.toUpperCase(Locale.ROOT);
        return u.contains("ROOM") || u.contains("CHARGE_ROOM");
    }

    private static boolean isBillLaterPayment(String pm) {
        if (pm == null || pm.isBlank()) {
            return false;
        }
        String u = pm.toUpperCase(Locale.ROOT);
        return u.contains("BILL LATER") || u.contains("BILL_LATER") || u.contains("DELIVERY");
    }

    private static String waiterDisplay(AppUser user) {
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail();
        }
        return user.getUsername();
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static ApiException notFound(String entity) {
        return new ApiException(HttpStatus.NOT_FOUND, entity + " not found");
    }

    private static String csv(Object value) {
        if (value == null) {
            return "";
        }
        String s = String.valueOf(value);
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    private record SummaryCalc(
            int totalOrders,
            int totalCovers,
            BigDecimal totalCash,
            BigDecimal totalCard,
            BigDecimal totalRoomCharge,
            BigDecimal totalRevenue,
            BigDecimal totalTax,
            BigDecimal totalTips,
            int totalCancelled,
            BigDecimal avgTicketValue,
            BigDecimal avgServeTimeMin,
            List<PosShiftDtos.ShiftTopItem> topItems,
            List<PosShiftDtos.ShiftDepotRow> revenueByDepot,
            List<PosShiftDtos.ShiftTicketSummary> tickets) {

        static SummaryCalc empty() {
            return new SummaryCalc(
                    0,
                    0,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    0,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    List.of(),
                    List.of(),
                    List.of());
        }
    }
}
