package com.hms.service;

import com.hms.api.dto.PosAnalyticsDtos;
import com.hms.domain.PosTicketLineStatus;
import com.hms.entity.PosTableTicket;
import com.hms.entity.PosTableTicketLine;
import com.hms.repository.PosTableTicketRepository;
import com.hms.security.TenantAccessService;
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
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PosAnalyticsService {

    private final TenantAccessService tenantAccessService;
    private final PosTableTicketRepository posTableTicketRepository;

    @Transactional(readOnly = true)
    public PosAnalyticsDtos.SummaryResponse summary(
            UUID hotelId, String hotelHeader, LocalDate from, LocalDate to, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicket> closed = loadClosed(hotelId, from, to, depotId);

        BigDecimal totalRevenue = sumRevenue(closed);
        int orders = closed.size();
        BigDecimal avgTicket = orders == 0
                ? BigDecimal.ZERO
                : totalRevenue.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP);
        long avgServe = Math.round(closed.stream()
                .filter(t -> t.getOpenedAt() != null && t.getClosedAt() != null)
                .mapToLong(t -> ChronoUnit.MINUTES.between(t.getOpenedAt(), t.getClosedAt()))
                .average()
                .orElse(0));
        int covers = closed.stream().mapToInt(PosTableTicket::getGuestCount).sum();

        Map<String, BigDecimal> byPayment = new LinkedHashMap<>();
        for (PosTableTicket t : closed) {
            String pm = normalizePayment(t.getPaymentMethod());
            byPayment.merge(pm, t.getTotalAmount(), BigDecimal::add);
        }

        Map<String, PosAnalyticsDtos.DepotSlice> depotMap = new LinkedHashMap<>();
        for (PosTableTicket t : closed) {
            String name = t.getDepot().getName();
            PosAnalyticsDtos.DepotSlice prev = depotMap.get(name);
            if (prev == null) {
                depotMap.put(name, new PosAnalyticsDtos.DepotSlice(name, t.getTotalAmount(), 1));
            } else {
                depotMap.put(
                        name,
                        new PosAnalyticsDtos.DepotSlice(
                                name, prev.revenue().add(t.getTotalAmount()), prev.orders() + 1));
            }
        }

        return new PosAnalyticsDtos.SummaryResponse(
                totalRevenue,
                orders,
                avgTicket,
                avgServe,
                covers,
                byPayment,
                new ArrayList<>(depotMap.values()));
    }

    @Transactional(readOnly = true)
    public List<PosAnalyticsDtos.HourlySlot> hourly(UUID hotelId, String hotelHeader, LocalDate date, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicket> closed = loadClosed(hotelId, date, date, depotId);
        Map<Integer, BigDecimal> rev = new HashMap<>();
        Map<Integer, Integer> cnt = new HashMap<>();
        ZoneId zone = ZoneId.systemDefault();
        for (PosTableTicket t : closed) {
            if (t.getClosedAt() == null) continue;
            int hour = t.getClosedAt().atZone(zone).getHour();
            rev.merge(hour, t.getTotalAmount(), BigDecimal::add);
            cnt.merge(hour, 1, Integer::sum);
        }
        List<PosAnalyticsDtos.HourlySlot> slots = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            slots.add(new PosAnalyticsDtos.HourlySlot(h, rev.getOrDefault(h, BigDecimal.ZERO), cnt.getOrDefault(h, 0)));
        }
        return slots;
    }

    @Transactional(readOnly = true)
    public List<PosAnalyticsDtos.TopItemRow> topItems(
            UUID hotelId, String hotelHeader, LocalDate from, LocalDate to, UUID depotId, int limit) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicket> closed = loadClosed(hotelId, from, to, depotId);
        long days = Math.max(1, ChronoUnit.DAYS.between(from, to) + 1);
        Map<String, Integer> qty = new HashMap<>();
        Map<String, BigDecimal> rev = new HashMap<>();
        for (PosTableTicket t : closed) {
            for (PosTableTicketLine line : t.getLines()) {
                if (line.getLineStatus() == PosTicketLineStatus.CANCELLED) continue;
                String name = lineName(line);
                qty.merge(name, line.getQuantity().intValue(), Integer::sum);
                rev.merge(name, line.getLineTotal(), BigDecimal::add);
            }
        }
        return rev.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(Math.max(1, limit))
                .map(e -> new PosAnalyticsDtos.TopItemRow(
                        e.getKey(),
                        qty.getOrDefault(e.getKey(), 0),
                        e.getValue(),
                        BigDecimal.valueOf(qty.getOrDefault(e.getKey(), 0))
                                .divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PosAnalyticsDtos.WaiterRow> waiters(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicket> closed = loadClosed(hotelId, from, to, null);
        Map<UUID, List<PosTableTicket>> byWaiter = closed.stream()
                .filter(t -> t.getStaffUser() != null)
                .collect(Collectors.groupingBy(t -> t.getStaffUser().getId()));
        return byWaiter.values().stream()
                .map(list -> {
                    BigDecimal rev = sumRevenue(list);
                    int count = list.size();
                    BigDecimal avg = count == 0
                            ? BigDecimal.ZERO
                            : rev.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
                    long serve = Math.round(list.stream()
                            .filter(t -> t.getOpenedAt() != null && t.getClosedAt() != null)
                            .mapToLong(t -> ChronoUnit.MINUTES.between(t.getOpenedAt(), t.getClosedAt()))
                            .average()
                            .orElse(0));
                    String name = waiterName(list.get(0));
                    return new PosAnalyticsDtos.WaiterRow(name, count, rev, avg, serve);
                })
                .sorted(Comparator.comparing(PosAnalyticsDtos.WaiterRow::revenue).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PosAnalyticsDtos.TableRow> tables(
            UUID hotelId, String hotelHeader, LocalDate from, LocalDate to, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicket> closed = loadClosed(hotelId, from, to, depotId);
        Map<String, List<PosTableTicket>> byTable =
                closed.stream().collect(Collectors.groupingBy(PosTableTicket::getTableLabel));
        return byTable.entrySet().stream()
                .map(e -> {
                    List<PosTableTicket> list = e.getValue();
                    BigDecimal rev = sumRevenue(list);
                    long avgOcc = Math.round(list.stream()
                            .filter(t -> t.getOpenedAt() != null && t.getClosedAt() != null)
                            .mapToLong(t -> ChronoUnit.MINUTES.between(t.getOpenedAt(), t.getClosedAt()))
                            .average()
                            .orElse(0));
                    return new PosAnalyticsDtos.TableRow(e.getKey(), list.size(), rev, avgOcc, list.size());
                })
                .sorted(Comparator.comparing(PosAnalyticsDtos.TableRow::totalRevenue).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PosAnalyticsDtos.DailyRevenueRow> dailySeries(
            UUID hotelId, String hotelHeader, LocalDate from, LocalDate to, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicket> closed = loadClosed(hotelId, from, to, depotId);
        ZoneId zone = ZoneId.systemDefault();
        Map<LocalDate, BigDecimal> rev = new LinkedHashMap<>();
        Map<LocalDate, Integer> cnt = new LinkedHashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            rev.put(d, BigDecimal.ZERO);
            cnt.put(d, 0);
        }
        for (PosTableTicket t : closed) {
            if (t.getClosedAt() == null) continue;
            LocalDate d = t.getClosedAt().atZone(zone).toLocalDate();
            rev.merge(d, t.getTotalAmount(), BigDecimal::add);
            cnt.merge(d, 1, Integer::sum);
        }
        return rev.entrySet().stream()
                .map(e -> new PosAnalyticsDtos.DailyRevenueRow(
                        e.getKey().toString(), e.getValue(), cnt.get(e.getKey())))
                .toList();
    }

    @Transactional(readOnly = true)
    public String exportCsv(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<PosTableTicket> closed = loadClosed(hotelId, from, to, depotId);
        StringBuilder sb = new StringBuilder();
        sb.append("ticket_id,table_label,depot,waiter,closed_at,subtotal,tax,total,payment_method,guest_count\n");
        for (PosTableTicket t : closed) {
            sb.append(csv(t.getId()))
                    .append(',')
                    .append(csv(t.getTableLabel()))
                    .append(',')
                    .append(csv(t.getDepot().getName()))
                    .append(',')
                    .append(csv(waiterName(t)))
                    .append(',')
                    .append(t.getClosedAt())
                    .append(',')
                    .append(t.getSubtotal())
                    .append(',')
                    .append(t.getTaxAmount())
                    .append(',')
                    .append(t.getTotalAmount())
                    .append(',')
                    .append(csv(t.getPaymentMethod()))
                    .append(',')
                    .append(t.getGuestCount())
                    .append('\n');
        }
        return sb.toString();
    }

    private List<PosTableTicket> loadClosed(UUID hotelId, LocalDate from, LocalDate to, UUID depotId) {
        ZoneId zone = ZoneId.systemDefault();
        Instant start = from.atStartOfDay(zone).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(zone).toInstant();
        return posTableTicketRepository.findClosedBetween(hotelId, start, end).stream()
                .filter(t -> depotId == null || t.getDepot().getId().equals(depotId))
                .toList();
    }

    private static BigDecimal sumRevenue(List<PosTableTicket> tickets) {
        return tickets.stream().map(PosTableTicket::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String lineName(PosTableTicketLine line) {
        return line.getProductName() != null ? line.getProductName() : line.getProduct().getProductName();
    }

    private static String waiterName(PosTableTicket t) {
        if (t.getStaffUser() == null) return "—";
        if (t.getStaffUser().getEmail() != null && !t.getStaffUser().getEmail().isBlank()) {
            return t.getStaffUser().getEmail();
        }
        return t.getStaffUser().getUsername();
    }

    private static String normalizePayment(String pm) {
        if (pm == null || pm.isBlank()) return "OTHER";
        String u = pm.toUpperCase(Locale.ROOT);
        if (u.contains("CASH")) return "CASH";
        if (u.contains("CARD")) return "CARD";
        if (u.contains("ROOM")) return "ROOM";
        return "OTHER";
    }

    private static String csv(Object v) {
        if (v == null) return "";
        String s = String.valueOf(v);
        if (s.contains(",") || s.contains("\"")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
