package com.hms.service;

import com.hms.api.dto.MobilePosDtos;
import com.hms.domain.PosTableTicketStatus;
import com.hms.entity.AppUser;
import com.hms.entity.DepotSale;
import com.hms.entity.PosDeliveryOrder;
import com.hms.entity.PosDeliveryOrderLine;
import com.hms.entity.PosTableTicket;
import com.hms.entity.PosTableTicketLine;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.PosDeliveryOrderRepository;
import com.hms.repository.PosTableTicketRepository;
import com.hms.security.TenantAccessService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PosOrderNotificationService {

    private final PosWebSocketPublisher posWebSocketPublisher;
    private final PosTableTicketRepository posTableTicketRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final PosDeliveryOrderRepository posDeliveryOrderRepository;
    private final TenantAccessService tenantAccessService;

    public PosOrderNotificationService(
            PosWebSocketPublisher posWebSocketPublisher,
            PosTableTicketRepository posTableTicketRepository,
            DepotSaleRepository depotSaleRepository,
            PosDeliveryOrderRepository posDeliveryOrderRepository,
            TenantAccessService tenantAccessService) {
        this.posWebSocketPublisher = posWebSocketPublisher;
        this.posTableTicketRepository = posTableTicketRepository;
        this.depotSaleRepository = depotSaleRepository;
        this.posDeliveryOrderRepository = posDeliveryOrderRepository;
        this.tenantAccessService = tenantAccessService;
    }

    public void publishKitchenTicket(PosTableTicket ticket) {
        MobilePosDtos.PosOrderNotificationRow row = fromTicket(ticket, "KITCHEN_ORDER");
        posWebSocketPublisher.publishPosOrder(ticket.getHotel().getId(), row);
    }

    public void publishTicketItemsAdded(PosTableTicket ticket) {
        MobilePosDtos.PosOrderNotificationRow row = fromTicket(ticket, "TICKET_ITEMS_ADDED");
        posWebSocketPublisher.publishPosOrder(ticket.getHotel().getId(), row);
    }

    public void publishSale(DepotSale sale) {
        MobilePosDtos.PosOrderNotificationRow row = fromSale(sale);
        posWebSocketPublisher.publishPosOrder(sale.getHotel().getId(), row);
    }

    public void publishDelivery(PosDeliveryOrder order) {
        MobilePosDtos.PosOrderNotificationRow row = fromDelivery(order);
        posWebSocketPublisher.publishPosOrder(order.getHotel().getId(), row);
    }

    @Transactional(readOnly = true)
    public List<MobilePosDtos.PosOrderNotificationRow> recent(UUID hotelId, String hotelHeader, Instant since) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Instant cutoff = since != null ? since : Instant.now().minus(8, ChronoUnit.HOURS);
        List<MobilePosDtos.PosOrderNotificationRow> rows = new ArrayList<>();

        List<PosTableTicketStatus> kitchenStatuses =
                List.of(PosTableTicketStatus.OPEN, PosTableTicketStatus.SENT_TO_KITCHEN);
        for (PosTableTicket ticket :
                posTableTicketRepository.findRecentKitchenTickets(hotelId, kitchenStatuses, cutoff)) {
            String type = ticket.getStatus() == PosTableTicketStatus.SENT_TO_KITCHEN
                    ? "KITCHEN_ORDER"
                    : "OPEN_TICKET";
            rows.add(fromTicket(ticket, type));
        }
        for (DepotSale sale : depotSaleRepository.findRecentStaffSales(hotelId, cutoff)) {
            rows.add(fromSale(sale));
        }
        for (PosDeliveryOrder order : posDeliveryOrderRepository.findRecentStaffDeliveries(hotelId, cutoff)) {
            rows.add(fromDelivery(order));
        }

        return rows.stream()
                .sorted(Comparator.comparing(MobilePosDtos.PosOrderNotificationRow::at).reversed())
                .limit(40)
                .toList();
    }

    private MobilePosDtos.PosOrderNotificationRow fromTicket(PosTableTicket ticket, String eventType) {
        List<PosTableTicketLine> lines = ticket.getLines();
        String summary = summarizeNames(lines.stream().map(l -> l.getProduct().getProductName()).toList());
        StaffRef staff = staffRef(ticket.getStaffUser(), null);
        String table = ticket.getTableLabel() != null ? ticket.getTableLabel() : "—";
        String depot = ticket.getDepot() != null ? ticket.getDepot().getName() : "Outlet";
        String title = titleFor(eventType, table);
        String body = bodyFor(staff, depot, lines.size(), summary);
        return new MobilePosDtos.PosOrderNotificationRow(
                ticket.getId(),
                eventType,
                title,
                body,
                staff.username(),
                staff.displayName(),
                table,
                depot,
                lines.size(),
                summary,
                ticket.getUpdatedAt() != null ? ticket.getUpdatedAt() : ticket.getCreatedAt(),
                ticket.getId(),
                null,
                null);
    }

    private MobilePosDtos.PosOrderNotificationRow fromSale(DepotSale sale) {
        List<String> names = sale.getLines().stream().map(l -> l.getProduct().getProductName()).toList();
        String summary = summarizeNames(names);
        StaffRef staff = staffRef(sale.getStaffUser(), sale.getCreatedBy());
        String table = sale.getTableLabel() != null ? sale.getTableLabel() : "—";
        String depot = sale.getDepot() != null ? sale.getDepot().getName() : "Outlet";
        String payment = sale.getPaymentMethod() != null ? sale.getPaymentMethod() : "SALE";
        String title = "ROOM".equalsIgnoreCase(payment) ? "Room charge — " + table : "POS sale — " + table;
        String body = bodyFor(staff, depot, names.size(), summary);
        return new MobilePosDtos.PosOrderNotificationRow(
                sale.getId(),
                "POS_SALE",
                title,
                body,
                staff.username(),
                staff.displayName(),
                table,
                depot,
                names.size(),
                summary,
                sale.getCreatedAt(),
                null,
                sale.getId(),
                null);
    }

    private MobilePosDtos.PosOrderNotificationRow fromDelivery(PosDeliveryOrder order) {
        List<String> names = order.getLines().stream()
                .map(PosDeliveryOrderLine::getProduct)
                .map(p -> p.getProductName())
                .toList();
        String summary = summarizeNames(names);
        StaffRef staff = staffRef(order.getStaffUser(), order.getCreatedBy());
        String table = order.getLocationLabel() != null ? order.getLocationLabel() : "—";
        String depot = order.getDepot() != null ? order.getDepot().getName() : "Outlet";
        String title = "Bill later — " + table;
        String body = bodyFor(staff, depot, names.size(), summary);
        return new MobilePosDtos.PosOrderNotificationRow(
                order.getId(),
                "POS_DELIVERY",
                title,
                body,
                staff.username(),
                staff.displayName(),
                table,
                depot,
                names.size(),
                summary,
                order.getCreatedAt(),
                null,
                null,
                order.getId());
    }

    private static String titleFor(String eventType, String table) {
        return switch (eventType) {
            case "KITCHEN_ORDER" -> "Kitchen order — " + table;
            case "TICKET_ITEMS_ADDED" -> "Items added — " + table;
            default -> "Table order — " + table;
        };
    }

    private static String bodyFor(StaffRef staff, String depot, int itemCount, String summary) {
        String who = staff.displayName() != null && !staff.displayName().isBlank()
                ? staff.displayName()
                : (staff.username() != null ? staff.username() : "Staff");
        String items = itemCount == 1 ? "1 item" : itemCount + " items";
        return who + " · " + depot + " · " + items + (summary.isBlank() ? "" : " · " + summary);
    }

    private static String summarizeNames(List<String> names) {
        if (names == null || names.isEmpty()) {
            return "";
        }
        String head = names.stream().limit(3).collect(Collectors.joining(", "));
        if (names.size() > 3) {
            return head + " +" + (names.size() - 3);
        }
        return head;
    }

    private static StaffRef staffRef(AppUser user, String createdByFallback) {
        if (user != null) {
            String display = user.getEmail() != null && !user.getEmail().isBlank()
                    ? user.getEmail()
                    : user.getUsername();
            return new StaffRef(user.getUsername(), display);
        }
        if (createdByFallback != null && !createdByFallback.isBlank()) {
            return new StaffRef(createdByFallback, createdByFallback);
        }
        return new StaffRef(null, "Staff");
    }

    private record StaffRef(String username, String displayName) {}
}
