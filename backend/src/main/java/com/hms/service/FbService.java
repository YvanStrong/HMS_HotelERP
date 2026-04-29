package com.hms.service;

import com.hms.api.dto.FbDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.FbMenuItemKind;
import com.hms.domain.FbOrderStatus;
import com.hms.domain.FbOrderType;
import com.hms.domain.FbOutletType;
import com.hms.domain.FbPaymentStatus;
import com.hms.domain.ReservationStatus;
import com.hms.entity.FbOrder;
import com.hms.entity.FbOrderLine;
import com.hms.entity.FbOutlet;
import com.hms.entity.MenuItem;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.FbOrderRepository;
import com.hms.repository.FbOutletRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.repository.MenuItemRepository;
import com.hms.repository.ReservationRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.Year;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FbService {

    private static final BigDecimal TAX_RATE = new BigDecimal("0.15");

    private final FbOutletRepository fbOutletRepository;
    private final MenuItemRepository menuItemRepository;
    private final HotelRepository hotelRepository;
    private final FbOrderRepository fbOrderRepository;
    private final ReservationRepository reservationRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final ChargeService chargeService;
    private final FacilityWebSocketPublisher facilityWebSocketPublisher;
    private final TenantAccessService tenantAccessService;

    public FbService(
            FbOutletRepository fbOutletRepository,
            MenuItemRepository menuItemRepository,
            HotelRepository hotelRepository,
            FbOrderRepository fbOrderRepository,
            ReservationRepository reservationRepository,
            InventoryItemRepository inventoryItemRepository,
            ChargeService chargeService,
            FacilityWebSocketPublisher facilityWebSocketPublisher,
            TenantAccessService tenantAccessService) {
        this.fbOutletRepository = fbOutletRepository;
        this.menuItemRepository = menuItemRepository;
        this.hotelRepository = hotelRepository;
        this.fbOrderRepository = fbOrderRepository;
        this.reservationRepository = reservationRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.chargeService = chargeService;
        this.facilityWebSocketPublisher = facilityWebSocketPublisher;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional(readOnly = true)
    public List<FbDtos.FbOutletListItem> listOutlets(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        return fbOutletRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(o -> new FbDtos.FbOutletListItem(
                        o.getId(), o.getName(), o.getCode(), o.getOutletType().name(), o.isAllowsRoomCharge()))
                .toList();
    }

    @Transactional
    public FbDtos.CreateFbOutletResponse createOutlet(
            UUID hotelId, String hotelHeader, FbDtos.CreateFbOutletRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        String code = req.code().trim();
        if (fbOutletRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Outlet code already exists for this hotel");
        }
        FbOutletType type = FbOutletType.valueOf(req.outletType().trim().toUpperCase());
        FbOutlet o = new FbOutlet();
        o.setHotel(hotelRepository.getReferenceById(hotelId));
        o.setName(req.name().trim());
        o.setCode(code);
        o.setOutletType(type);
        o.setDescription(req.description());
        if (req.allowsRoomCharge() != null) {
            o.setAllowsRoomCharge(req.allowsRoomCharge());
        }
        if (req.acceptsReservations() != null) {
            o.setAcceptsReservations(req.acceptsReservations());
        }
        o = fbOutletRepository.save(o);
        return new FbDtos.CreateFbOutletResponse(
                o.getId(),
                o.getName(),
                o.getCode(),
                o.getOutletType().name(),
                o.isAllowsRoomCharge(),
                "F&B outlet created");
    }

    @Transactional
    public FbDtos.CreateMenuItemResponse createMenuItem(
            UUID hotelId, String hotelHeader, UUID outletId, FbDtos.CreateMenuItemRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FbOutlet outlet =
                fbOutletRepository.findByIdAndHotel_Id(outletId, hotelId).orElseThrow(() -> notFound("Outlet"));
        String code = req.code().trim();
        if (menuItemRepository.existsByOutlet_IdAndCodeIgnoreCase(outlet.getId(), code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Menu item code already exists for this outlet");
        }
        FbMenuItemKind kind = FbMenuItemKind.FOOD;
        if (req.itemKind() != null && !req.itemKind().isBlank()) {
            kind = FbMenuItemKind.valueOf(req.itemKind().trim().toUpperCase());
        }
        MenuItem m = new MenuItem();
        m.setOutlet(outlet);
        m.setName(req.name().trim());
        m.setCode(code);
        m.setDescription(req.description());
        m.setPrice(req.price().setScale(2, RoundingMode.HALF_UP));
        m.setItemKind(kind);
        if (req.categories() != null && !req.categories().isEmpty()) {
            m.getCategories().addAll(req.categories());
        } else {
            m.getCategories().add("General");
        }
        m = menuItemRepository.save(m);
        return new FbDtos.CreateMenuItemResponse(
                m.getId(), outlet.getId(), m.getName(), m.getCode(), "Menu item created");
    }

    private void ensureHotel(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
    }

    @Transactional(readOnly = true)
    public FbDtos.FbMenuResponse menu(
            UUID hotelId,
            String hotelHeader,
            UUID outletId,
            String category,
            String dietary,
            boolean availableOnly) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FbOutlet outlet =
                fbOutletRepository.findByIdAndHotel_Id(outletId, hotelId).orElseThrow(() -> notFound("Outlet"));
        List<MenuItem> items = menuItemRepository.findByOutlet_IdOrderByNameAsc(outletId);
        List<MenuItem> filtered = new ArrayList<>();
        for (MenuItem m : items) {
            if (availableOnly && !m.isAvailable()) {
                continue;
            }
            if (category != null
                    && !category.isBlank()
                    && m.getCategories().stream().noneMatch(c -> c.equalsIgnoreCase(category.trim()))) {
                continue;
            }
            if (dietary != null && !dietary.isBlank()) {
                String d = dietary.trim().toLowerCase();
                boolean tagMatch = m.getCategories().stream().anyMatch(c -> c.toLowerCase().contains(d));
                if (!tagMatch) {
                    continue;
                }
            }
            filtered.add(m);
        }

        Map<String, List<FbDtos.FbMenuItemRow>> byCat = new LinkedHashMap<>();
        for (MenuItem m : filtered) {
            String cat = m.getCategories().isEmpty() ? "General" : m.getCategories().get(0);
            byCat.computeIfAbsent(cat, k -> new ArrayList<>())
                    .add(new FbDtos.FbMenuItemRow(
                            m.getId(),
                            m.getName(),
                            m.getDescription(),
                            m.getPrice(),
                            List.copyOf(m.getCategories()),
                            List.copyOf(m.getAllergens()),
                            m.isAvailable(),
                            m.getPrepTimeMinutes(),
                            m.getImageUrl()));
        }
        List<FbDtos.FbMenuCategory> categories = new ArrayList<>();
        byCat.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> categories.add(new FbDtos.FbMenuCategory(e.getKey(), e.getValue())));

        Map<String, Object> outletMap = new HashMap<>();
        outletMap.put("id", outlet.getId());
        outletMap.put("name", outlet.getName());
        outletMap.put("type", outlet.getOutletType().name());
        outletMap.put("allowsRoomCharge", outlet.isAllowsRoomCharge());

        Map<String, Object> menuMap = new HashMap<>();
        menuMap.put("categories", categories);

        Map<String, Object> rules = new HashMap<>();
        rules.put("minOrderValue", 0);
        rules.put("roomChargeEnabled", outlet.isAllowsRoomCharge());
        rules.put("requiresReservation", false);
        rules.put("allergyDisclaimer", "Please inform staff of any allergies");

        return new FbDtos.FbMenuResponse(outletMap, menuMap, rules);
    }

    @Transactional
    public FbDtos.CreateFbOrderResponse createOrder(UUID hotelId, String hotelHeader, FbDtos.CreateFbOrderRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FbOutlet outlet =
                fbOutletRepository.findByIdAndHotel_Id(req.outletId(), hotelId).orElseThrow(() -> notFound("Outlet"));
        FbOrderType type = FbOrderType.valueOf(req.type().trim().toUpperCase());
        if (type == FbOrderType.ROOM_SERVICE && req.reservationId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "reservationId is required for ROOM_SERVICE");
        }
        Reservation res = null;
        if (req.reservationId() != null) {
            res = reservationRepository
                    .findByIdAndHotel_Id(req.reservationId(), hotelId)
                    .orElseThrow(() -> notFound("Reservation"));
        }

        FbOrder order = new FbOrder();
        order.setOutlet(outlet);
        order.setGuestReservation(res);
        order.setOrderType(type);
        order.setOrderNumber(nextOrderNumber(hotelId));
        order.setStatus(FbOrderStatus.OPEN);
        order.setPaymentStatus(FbPaymentStatus.PENDING);

        BigDecimal subtotal = BigDecimal.ZERO;
        int maxPrep = 0;
        int ord = 0;
        for (FbDtos.FbOrderLineInput li : req.lines()) {
            MenuItem mi = menuItemRepository
                    .findByIdAndOutlet_Id(li.menuItemId(), outlet.getId())
                    .orElseThrow(() -> notFound("Menu item"));
            if (!mi.isAvailable()) {
                throw new ApiException(HttpStatus.CONFLICT, "Menu item not available: " + mi.getName());
            }
            int qty = li.quantity();
            BigDecimal unit = mi.getPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unit.multiply(BigDecimal.valueOf(qty)).setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineTotal);
            maxPrep = Math.max(maxPrep, mi.getPrepTimeMinutes() != null ? mi.getPrepTimeMinutes() : 15);

            FbOrderLine line = new FbOrderLine();
            line.setOrder(order);
            line.setMenuItem(mi);
            line.setLineOrder(ord++);
            line.setQuantity(qty);
            line.setUnitPrice(unit);
            line.setLineTotal(lineTotal);
            if (li.modifiers() != null) {
                line.getModifiers().addAll(li.modifiers());
            }
            line.setSpecialInstructions(li.specialInstructions());
            line.setStation("KITCHEN");
            line.setInventoryDeducted(false);
            order.getLines().add(line);
        }
        BigDecimal tax = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(tax).setScale(2, RoundingMode.HALF_UP);
        order.setSubtotal(subtotal);
        order.setTax(tax);
        order.setTotal(total);
        order = fbOrderRepository.save(order);

        Map<String, BigDecimal> totals = Map.of("subtotal", subtotal, "tax", tax, "total", total);
        Map<String, Object> roomChargeMap = null;
        Map<String, Object> guestNotification = new HashMap<>();
        guestNotification.put("sent", false);
        guestNotification.put("method", "app_push");
        guestNotification.put("message", "Order " + order.getOrderNumber() + " received");

        if (req.payment() != null && "ROOM_CHARGE".equalsIgnoreCase(req.payment().method())) {
            if (res == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "reservationId required for ROOM_CHARGE");
            }
            if (res.getStatus() != ReservationStatus.CHECKED_IN) {
                throw new ApiException(HttpStatus.CONFLICT, "Reservation must be CHECKED_IN to post room charge");
            }
            if (!outlet.isAllowsRoomCharge()) {
                throw new ApiException(HttpStatus.CONFLICT, "This outlet does not allow room charge");
            }
            String desc =
                    req.payment().roomChargeDescription() != null && !req.payment().roomChargeDescription().isBlank()
                            ? req.payment().roomChargeDescription()
                            : "F&B " + order.getOrderNumber();
            RoomCharge ch = chargeService.postFolioCharge(
                    hotelId, res, total, desc, ChargeType.FNB, "fb-pos", "{\"fbOrderId\":\"" + order.getId() + "\"}");
            order.setRoomCharge(ch);
            order.setPaymentStatus(FbPaymentStatus.CHARGED_TO_ROOM);
            fbOrderRepository.save(order);
            roomChargeMap = new HashMap<>();
            roomChargeMap.put("chargeId", ch.getId());
            roomChargeMap.put("description", desc);
            roomChargeMap.put("amount", total);
            roomChargeMap.put("postedToFolio", true);
            roomChargeMap.put("folioUrl", "/api/v1/hotels/" + hotelId + "/reservations/" + res.getId() + "/folio");
            facilityWebSocketPublisher.publishFolioCharge(
                    res.getId(),
                    Map.of("type", "folio.charge.added", "chargeId", ch.getId().toString(), "amount", ch.getAmount()));
        }

        List<Map<String, Object>> routing = List.of(Map.of(
                "station",
                "KITCHEN",
                "items",
                order.getLines().stream()
                        .map(l -> l.getMenuItem().getName() + " x" + l.getQuantity())
                        .toList(),
                "priority",
                "NORMAL"));

        Instant ready = order.getOrderTime().plusSeconds(maxPrep * 60L);
        return new FbDtos.CreateFbOrderResponse(
                order.getId(), order.getOrderNumber(), order.getStatus().name(), ready, totals, roomChargeMap, routing, guestNotification);
    }

    private String nextOrderNumber(UUID hotelId) {
        long n = fbOrderRepository.countByHotelId(hotelId) + 1;
        return "FNB-" + Year.now().getValue() + "-" + String.format("%05d", n);
    }

    @Transactional
    public FbDtos.PatchFbOrderResponse patchOrder(
            UUID hotelId, String hotelHeader, UUID orderId, FbDtos.PatchFbOrderRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FbOrder order = fbOrderRepository
                .findByIdAndOutlet_Hotel_Id(orderId, hotelId)
                .orElseThrow(() -> notFound("Order"));
        String prev = order.getStatus().name();
        if (req.status() != null && !req.status().isBlank()) {
            FbOrderStatus next = FbOrderStatus.valueOf(req.status().trim().toUpperCase());
            order.setStatus(next);
            if (next == FbOrderStatus.SERVED) {
                order.setServedTime(req.timestamp() != null ? req.timestamp() : Instant.now());
            }
            if (next == FbOrderStatus.CLOSED) {
                order.setClosedTime(req.timestamp() != null ? req.timestamp() : Instant.now());
            }
        }
        List<Map<String, Object>> sideEffects = new ArrayList<>();
        if (Boolean.TRUE.equals(req.inventoryDeducted())) {
            deductInventory(order, sideEffects);
        }
        fbOrderRepository.save(order);

        List<String> nextActions = List.of("Mark CLOSED when service complete", "Request guest feedback");
        return new FbDtos.PatchFbOrderResponse(
                order.getId(),
                prev,
                order.getStatus().name(),
                Instant.now(),
                sideEffects,
                nextActions);
    }

    private void deductInventory(FbOrder order, List<Map<String, Object>> sideEffects) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (FbOrderLine line : order.getLines()) {
            if (line.isInventoryDeducted()) {
                continue;
            }
            MenuItem mi = line.getMenuItem();
            if (mi.getLinkedInventoryItem() == null) {
                continue;
            }
            var inv = inventoryItemRepository.findById(mi.getLinkedInventoryItem().getId()).orElse(null);
            if (inv == null) {
                continue;
            }
            BigDecimal qty = BigDecimal.valueOf(line.getQuantity());
            BigDecimal next = inv.getCurrentStock().subtract(qty);
            if (next.signum() < 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient inventory for " + inv.getSku());
            }
            inv.setCurrentStock(next);
            inventoryItemRepository.save(inv);
            line.setInventoryDeducted(true);
            items.add(Map.of("sku", inv.getSku(), "quantity", line.getQuantity(), "newStock", next));
        }
        if (!items.isEmpty()) {
            sideEffects.add(Map.of("type", "INVENTORY_DEDUCTED", "items", items));
        }
        sideEffects.add(Map.of(
                "type",
                "GUEST_NOTIFIED",
                "method",
                "app_push",
                "message",
                "Your order status was updated"));
    }

    @Transactional
    public FbDtos.ChargeFbOrderToRoomResponse chargeOrderToRoom(
            UUID hotelId, String hotelHeader, UUID orderId, FbDtos.ChargeFbOrderToRoomRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FbOrder order = fbOrderRepository
                .findByIdAndOutlet_Hotel_Id(orderId, hotelId)
                .orElseThrow(() -> notFound("Order"));
        if (order.getPaymentStatus() == FbPaymentStatus.CHARGED_TO_ROOM) {
            throw new ApiException(HttpStatus.CONFLICT, "Order already charged to room");
        }
        Reservation res = reservationRepository
                .findByIdAndHotel_Id(req.reservationId(), hotelId)
                .orElseThrow(() -> notFound("Reservation"));
        if (res.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ApiException(HttpStatus.CONFLICT, "Reservation must be CHECKED_IN");
        }
        String desc = req.chargeDescription() != null && !req.chargeDescription().isBlank()
                ? req.chargeDescription()
                : "F&B " + order.getOrderNumber();
        RoomCharge ch = chargeService.postFolioCharge(
                hotelId, res, order.getTotal(), desc, ChargeType.FNB, "fb-pos", "{\"fbOrderId\":\"" + order.getId() + "\"}");
        order.setRoomCharge(ch);
        order.setPaymentStatus(FbPaymentStatus.CHARGED_TO_ROOM);
        fbOrderRepository.save(order);
        facilityWebSocketPublisher.publishFolioCharge(
                res.getId(),
                Map.of("type", "folio.charge.added", "chargeId", ch.getId().toString(), "amount", ch.getAmount()));
        List<Map<String, Object>> charges = new ArrayList<>();
        charges.add(Map.of(
                "chargeId",
                ch.getId(),
                "amount",
                ch.getAmount(),
                "description",
                desc,
                "postedToFolio",
                true));
        Map<String, Object> orderMap = new HashMap<>();
        orderMap.put("paymentStatus", order.getPaymentStatus().name());
        orderMap.put("originalPaymentMethod", "PENDING");
        orderMap.put("refundProcessed", false);
        return new FbDtos.ChargeFbOrderToRoomResponse(order.getId(), charges, orderMap);
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
