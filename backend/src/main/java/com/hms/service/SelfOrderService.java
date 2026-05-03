package com.hms.service;

import com.hms.api.dto.SelfOrderDtos;
import com.hms.domain.SelfOrderPaymentStatus;
import com.hms.domain.SelfOrderServiceType;
import com.hms.domain.SelfOrderStatus;
import com.hms.entity.DepotProduct;
import com.hms.entity.Hotel;
import com.hms.entity.InventoryDepot;
import com.hms.entity.SelfServiceOrder;
import com.hms.entity.SelfServiceOrderLine;
import com.hms.repository.DepotProductRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.SelfServiceOrderRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SelfOrderService {

    private static final String DISPLAY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final HotelRepository hotelRepository;
    private final InventoryDepotRepository inventoryDepotRepository;
    private final DepotProductRepository depotProductRepository;
    private final SelfServiceOrderRepository selfServiceOrderRepository;
    private final TenantAccessService tenantAccessService;

    public SelfOrderService(
            HotelRepository hotelRepository,
            InventoryDepotRepository inventoryDepotRepository,
            DepotProductRepository depotProductRepository,
            SelfServiceOrderRepository selfServiceOrderRepository,
            TenantAccessService tenantAccessService) {
        this.hotelRepository = hotelRepository;
        this.inventoryDepotRepository = inventoryDepotRepository;
        this.depotProductRepository = depotProductRepository;
        this.selfServiceOrderRepository = selfServiceOrderRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.PublicMenuResponse publicMenu(UUID hotelId) {
        assertHotelExists(hotelId);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        boolean boardKey = hotel.getOrderBoardSecret() != null && !hotel.getOrderBoardSecret().isBlank();
        List<InventoryDepot> depots = inventoryDepotRepository.findByHotel_IdOrderByNameAsc(hotelId);
        List<SelfOrderDtos.PublicDepotBrief> depotRows = depots.stream()
                .filter(InventoryDepot::isActive)
                .map(d -> new SelfOrderDtos.PublicDepotBrief(d.getId(), d.getName()))
                .toList();
        List<DepotProduct> products = depotProductRepository.search(hotelId, null, null, true);
        List<SelfOrderDtos.PublicMenuItem> items = products.stream()
                .filter(DepotProduct::isActive)
                .sorted(Comparator.comparing(DepotProduct::getProductName, String.CASE_INSENSITIVE_ORDER))
                .map(p -> new SelfOrderDtos.PublicMenuItem(
                        p.getId(),
                        p.getDepot().getId(),
                        p.getDepot().getName(),
                        p.getProductName(),
                        p.getProductCode(),
                        p.getSellingPrice(),
                        p.getPhotoUrl(),
                        p.getMenuName(),
                        canonicalStockTypeForApi(p.getStockType()),
                        p.getStockQty(),
                        p.isActive()))
                .toList();
        return new SelfOrderDtos.PublicMenuResponse(hotel.getCurrency(), boardKey, depotRows, items);
    }

    @Transactional
    public SelfOrderDtos.CreatePublicOrderResponse createPublicOrder(UUID hotelId, SelfOrderDtos.CreatePublicOrderRequest req) {
        assertHotelExists(hotelId);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        SelfOrderServiceType serviceType = parseServiceType(req.serviceType());
        PaymentMode mode = parsePaymentMode(req.paymentMode());
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        if (!depot.isActive()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Depot is not active");
        }

        SelfServiceOrder order = new SelfServiceOrder();
        order.setHotel(hotel);
        order.setDepot(depot);
        order.setOrderNumber(nextOrderNumber(hotelId));
        order.setDisplayCode(uniqueDisplayCode(hotelId));
        order.setTrackToken(UUID.randomUUID());
        order.setServiceType(serviceType);
        order.setStatus(SelfOrderStatus.PLACED);
        if (mode == PaymentMode.PAY_AT_COUNTER) {
            order.setPaymentStatus(SelfOrderPaymentStatus.UNPAID);
            order.setPaymentMethod("PAY_AT_COUNTER");
        } else {
            order.setPaymentStatus(SelfOrderPaymentStatus.PAID);
            order.setPaymentMethod("SIMULATED");
        }
        String note = req.customerNote() == null ? null : req.customerNote().trim();
        if (note != null && note.length() > 280) {
            note = note.substring(0, 280);
        }
        order.setCustomerNote(note == null || note.isEmpty() ? null : note);

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        for (SelfOrderDtos.CreateLineInput line : req.lines()) {
            if (line.quantity() == null || line.quantity().signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be positive");
            }
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(line.productId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            if (!p.isActive()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product is not available: " + p.getProductCode());
            }
            if (!p.getDepot().getId().equals(depot.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product does not belong to selected depot");
            }
            boolean managedStock = isManagedStockType(p.getStockType());
            if (managedStock && p.getStockQty().compareTo(line.quantity()) < 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + p.getProductCode());
            }
            BigDecimal unitPrice = scale2(p.getSellingPrice());
            BigDecimal lineTotal = scale2(unitPrice.multiply(line.quantity()));
            total = total.add(lineTotal);

            SelfServiceOrderLine sl = new SelfServiceOrderLine();
            sl.setOrder(order);
            sl.setProduct(p);
            sl.setLineOrder(lineOrder++);
            sl.setQuantity(line.quantity().setScale(3, RoundingMode.HALF_UP));
            sl.setUnitPrice(unitPrice);
            sl.setLineTotal(lineTotal);
            order.getLines().add(sl);

            if (mode == PaymentMode.SIMULATED && managedStock) {
                p.setStockQty(p.getStockQty().subtract(line.quantity()).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(p);
            }
        }
        order.setTotalAmount(scale2(total));
        order = selfServiceOrderRepository.save(order);

        String msg = mode == PaymentMode.PAY_AT_COUNTER
                ? "Order placed — pay at counter; staff will confirm payment before the kitchen sees it."
                : "Order placed";
        return new SelfOrderDtos.CreatePublicOrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getDisplayCode(),
                order.getTrackToken(),
                order.getServiceType().name(),
                order.getStatus().name(),
                order.getPaymentStatus().name(),
                order.getPaymentMethod(),
                order.getTotalAmount(),
                order.getCreatedAt(),
                msg);
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.TrackOrderResponse trackOrder(UUID hotelId, UUID trackToken) {
        assertHotelExists(hotelId);
        SelfServiceOrder order = selfServiceOrderRepository
                .findFetchedByTrackTokenAndHotel_Id(trackToken, hotelId)
                .orElseThrow(() -> notFound("Order"));
        return toTrackResponse(order);
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.BoardResponse boardOrders(UUID hotelId, String boardKey) {
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        assertBoardKey(hotel, boardKey);
        List<SelfOrderStatus> statuses = List.of(SelfOrderStatus.PLACED, SelfOrderStatus.IN_PROGRESS, SelfOrderStatus.READY);
        List<SelfServiceOrder> rows =
                selfServiceOrderRepository.findForBoard(hotelId, statuses, SelfOrderPaymentStatus.PAID);
        List<SelfOrderDtos.BoardOrderCard> cards = new ArrayList<>();
        for (SelfServiceOrder o : rows) {
            List<SelfOrderDtos.BoardLineBrief> lineBriefs = o.getLines().stream()
                    .sorted(Comparator.comparing(SelfServiceOrderLine::getLineOrder))
                    .map(l -> new SelfOrderDtos.BoardLineBrief(l.getProduct().getProductName(), l.getQuantity()))
                    .toList();
            cards.add(new SelfOrderDtos.BoardOrderCard(
                    o.getId(),
                    o.getDisplayCode(),
                    o.getServiceType().name(),
                    o.getStatus().name(),
                    o.getDepot().getName(),
                    o.getCreatedAt(),
                    lineBriefs));
        }
        return new SelfOrderDtos.BoardResponse(cards);
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.StaffSelfOrderSettings getSelfOrderSettings(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        boolean configured = hotel.getOrderBoardSecret() != null && !hotel.getOrderBoardSecret().isBlank();
        return new SelfOrderDtos.StaffSelfOrderSettings(configured, null);
    }

    @Transactional
    public SelfOrderDtos.StaffSelfOrderSettings updateSelfOrderSettings(
            UUID hotelId, String hotelHeader, SelfOrderDtos.PatchSelfOrderSettingsRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String echo = null;
        if (Boolean.TRUE.equals(req.clearBoardSecret())) {
            hotel.setOrderBoardSecret(null);
        } else if (req.orderBoardSecret() != null) {
            String s = req.orderBoardSecret().trim();
            if (s.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Use clearBoardSecret to remove the board key");
            }
            if (s.length() > 128) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "orderBoardSecret must be at most 128 characters");
            }
            hotel.setOrderBoardSecret(s);
            echo = s;
        }
        hotelRepository.save(hotel);
        boolean configured = hotel.getOrderBoardSecret() != null && !hotel.getOrderBoardSecret().isBlank();
        return new SelfOrderDtos.StaffSelfOrderSettings(configured, echo);
    }

    @Transactional(readOnly = true)
    public List<SelfOrderDtos.StaffOrderRow> listStaffOrders(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<SelfServiceOrder> rows =
                selfServiceOrderRepository.findRecentByHotel(hotelId, PageRequest.of(0, 80));
        List<SelfOrderDtos.StaffOrderRow> out = new ArrayList<>();
        for (SelfServiceOrder o : rows) {
            out.add(toStaffRow(o));
        }
        return out;
    }

    @Transactional
    public SelfOrderDtos.StaffOrderRow confirmPayment(
            UUID hotelId, String hotelHeader, UUID orderId, SelfOrderDtos.ConfirmPaymentRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        SelfServiceOrder order = selfServiceOrderRepository
                .findFetchedByIdAndHotel_Id(orderId, hotelId)
                .orElseThrow(() -> notFound("Order"));
        if (order.getPaymentStatus() != SelfOrderPaymentStatus.UNPAID) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Order is not awaiting payment");
        }
        String method = req.paymentMethod() == null ? "CASH" : req.paymentMethod().trim().toUpperCase(Locale.ROOT);
        if (method.isBlank() || method.length() > 40) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "paymentMethod is invalid");
        }
        for (SelfServiceOrderLine sl : order.getLines()) {
            DepotProduct p = sl.getProduct();
            boolean managed = isManagedStockType(p.getStockType());
            if (managed && p.getStockQty().compareTo(sl.getQuantity()) < 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + p.getProductCode());
            }
            if (managed) {
                p.setStockQty(p.getStockQty().subtract(sl.getQuantity()).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(p);
            }
        }
        order.setPaymentStatus(SelfOrderPaymentStatus.PAID);
        order.setPaymentMethod(method);
        order.setUpdatedAt(Instant.now());
        selfServiceOrderRepository.save(order);
        SelfServiceOrder fresh = selfServiceOrderRepository
                .findFetchedByIdAndHotel_Id(orderId, hotelId)
                .orElse(order);
        return toStaffRow(fresh);
    }

    @Transactional
    public SelfOrderDtos.StaffOrderRow patchStatus(
            UUID hotelId, String hotelHeader, UUID orderId, SelfOrderDtos.PatchOrderStatusRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        SelfOrderStatus next = parseStatus(req.status());
        SelfServiceOrder order = selfServiceOrderRepository
                .findFetchedByIdAndHotel_Id(orderId, hotelId)
                .orElseThrow(() -> notFound("Order"));
        SelfOrderStatus cur = order.getStatus();
        if (!isAllowedTransition(cur, next)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid status transition: " + cur + " -> " + next);
        }
        if (next == SelfOrderStatus.IN_PROGRESS && order.getPaymentStatus() == SelfOrderPaymentStatus.UNPAID) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Confirm payment before moving this order to the kitchen");
        }
        if (next == SelfOrderStatus.CANCELLED && order.getPaymentStatus() == SelfOrderPaymentStatus.PAID) {
            restoreStockForOrder(order);
        }
        order.setStatus(next);
        order.setUpdatedAt(Instant.now());
        selfServiceOrderRepository.save(order);
        SelfServiceOrder fresh = selfServiceOrderRepository
                .findFetchedByIdAndHotel_Id(orderId, hotelId)
                .orElse(order);
        return toStaffRow(fresh);
    }

    private void assertBoardKey(Hotel hotel, String providedKey) {
        String secret = hotel.getOrderBoardSecret();
        if (secret == null || secret.isBlank()) {
            return;
        }
        if (providedKey == null || !constantTimeEquals(secret, providedKey)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Board not found");
        }
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = (actual == null ? "" : actual).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    private void restoreStockForOrder(SelfServiceOrder order) {
        for (SelfServiceOrderLine sl : order.getLines()) {
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(sl.getProduct().getId(), order.getHotel().getId())
                    .orElse(null);
            if (p == null) continue;
            if (isManagedStockType(p.getStockType())) {
                p.setStockQty(p.getStockQty().add(sl.getQuantity()).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(p);
            }
        }
    }

    private static boolean isAllowedTransition(SelfOrderStatus from, SelfOrderStatus to) {
        if (from == to) return true;
        if (from == SelfOrderStatus.CANCELLED || from == SelfOrderStatus.COMPLETED) return false;
        if (to == SelfOrderStatus.CANCELLED) {
            return from == SelfOrderStatus.PLACED || from == SelfOrderStatus.IN_PROGRESS;
        }
        return switch (from) {
            case PLACED -> to == SelfOrderStatus.IN_PROGRESS;
            case IN_PROGRESS -> to == SelfOrderStatus.READY;
            case READY -> to == SelfOrderStatus.COMPLETED;
            default -> false;
        };
    }

    private SelfOrderDtos.StaffOrderRow toStaffRow(SelfServiceOrder o) {
        return new SelfOrderDtos.StaffOrderRow(
                o.getId(),
                o.getOrderNumber(),
                o.getDisplayCode(),
                o.getServiceType().name(),
                o.getStatus().name(),
                o.getPaymentStatus().name(),
                o.getPaymentMethod(),
                o.getDepot().getName(),
                o.getTotalAmount(),
                o.getCreatedAt(),
                o.getUpdatedAt(),
                lineTrackRows(o));
    }

    private SelfOrderDtos.TrackOrderResponse toTrackResponse(SelfServiceOrder o) {
        return new SelfOrderDtos.TrackOrderResponse(
                o.getId(),
                o.getOrderNumber(),
                o.getDisplayCode(),
                o.getServiceType().name(),
                o.getStatus().name(),
                o.getPaymentStatus().name(),
                o.getPaymentMethod(),
                o.getDepot().getName(),
                o.getTotalAmount(),
                o.getCreatedAt(),
                o.getUpdatedAt(),
                o.getCustomerNote(),
                lineTrackRows(o));
    }

    private List<SelfOrderDtos.TrackLineRow> lineTrackRows(SelfServiceOrder o) {
        return o.getLines().stream()
                .sorted(Comparator.comparing(SelfServiceOrderLine::getLineOrder))
                .map(l -> new SelfOrderDtos.TrackLineRow(
                        l.getProduct().getProductName(),
                        l.getProduct().getProductCode(),
                        l.getQuantity(),
                        l.getLineTotal()))
                .toList();
    }

    private void assertHotelExists(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw notFound("Hotel");
        }
    }

    private String uniqueDisplayCode(UUID hotelId) {
        for (int attempt = 0; attempt < 40; attempt++) {
            String code = randomDisplayCode();
            if (!selfServiceOrderRepository.existsByHotel_IdAndDisplayCodeIgnoreCase(hotelId, code)) {
                return code;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate order code");
    }

    private static String randomDisplayCode() {
        StringBuilder sb = new StringBuilder(4);
        for (int i = 0; i < 4; i++) {
            sb.append(DISPLAY_CHARS.charAt(RANDOM.nextInt(DISPLAY_CHARS.length())));
        }
        return sb.toString();
    }

    private String nextOrderNumber(UUID hotelId) {
        long next = selfServiceOrderRepository.countByHotel_Id(hotelId) + 1;
        return "SO-" + Year.now().getValue() + "-" + String.format("%05d", next);
    }

    private enum PaymentMode {
        SIMULATED,
        PAY_AT_COUNTER
    }

    private static PaymentMode parsePaymentMode(String raw) {
        if (raw == null || raw.isBlank()) {
            return PaymentMode.SIMULATED;
        }
        String v = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if ("PAY_AT_COUNTER".equals(v)) {
            return PaymentMode.PAY_AT_COUNTER;
        }
        if ("SIMULATED".equals(v) || "SIMULATE".equals(v)) {
            return PaymentMode.SIMULATED;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "paymentMode must be SIMULATED or PAY_AT_COUNTER");
    }

    private static SelfOrderServiceType parseServiceType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "serviceType is required (DINE_IN or TAKE_AWAY)");
        }
        String v = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        try {
            return SelfOrderServiceType.valueOf(v);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "serviceType must be DINE_IN or TAKE_AWAY");
        }
    }

    private static SelfOrderStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status is required");
        }
        String v = raw.trim().toUpperCase(Locale.ROOT);
        try {
            return SelfOrderStatus.valueOf(v);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid status value");
        }
    }

    private static BigDecimal scale2(BigDecimal n) {
        return n == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : n.setScale(2, RoundingMode.HALF_UP);
    }

    private static boolean isManagedStockType(String raw) {
        return "STOCK".equals(canonicalStockTypeOrDefaultStock(raw));
    }

    private static String canonicalStockTypeOrDefaultStock(String raw) {
        if (raw == null || raw.isBlank()) return "NON_STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        return "NON_STOCK";
    }

    private static String canonicalStockTypeForApi(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        return "STOCK";
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
