package com.hms.service;

import com.hms.api.dto.SelfOrderDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.SelfOrderStatusRules;
import com.hms.domain.ReservationStatus;
import com.hms.domain.SelfOrderPaymentStatus;
import com.hms.domain.SelfOrderServiceType;
import com.hms.domain.SelfOrderStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.entity.DepotProduct;
import com.hms.entity.Hotel;
import com.hms.entity.SelfOrderIdempotency;
import com.hms.entity.InventoryDepot;
import com.hms.entity.Reservation;
import com.hms.config.SelfOrderNotifyProperties;
import com.hms.entity.SelfOrderPushSubscription;
import com.hms.entity.SelfServiceOrder;
import com.hms.entity.SelfServiceOrderLine;
import com.hms.repository.DepotProductRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.SelfOrderEventRepository;
import com.hms.repository.SelfOrderIdempotencyRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.SelfOrderPushSubscriptionRepository;
import com.hms.repository.SelfServiceOrderRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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
    private final ChargeService chargeService;
    private final ReservationRepository reservationRepository;
    private final SelfOrderPushSubscriptionRepository pushSubscriptionRepository;
    private final SelfOrderNotificationService notificationService;
    private final SelfOrderNotifyProperties selfOrderNotifyProperties;
    private final SelfOrderIdempotencyRepository selfOrderIdempotencyRepository;
    private final ObjectMapper objectMapper;
    private final SelfOrderEventRecorder selfOrderEventRecorder;
    private final SelfOrderEventRepository selfOrderEventRepository;

    public SelfOrderService(
            HotelRepository hotelRepository,
            InventoryDepotRepository inventoryDepotRepository,
            DepotProductRepository depotProductRepository,
            SelfServiceOrderRepository selfServiceOrderRepository,
            TenantAccessService tenantAccessService,
            ChargeService chargeService,
            ReservationRepository reservationRepository,
            SelfOrderPushSubscriptionRepository pushSubscriptionRepository,
            SelfOrderNotificationService notificationService,
            SelfOrderNotifyProperties selfOrderNotifyProperties,
            SelfOrderIdempotencyRepository selfOrderIdempotencyRepository,
            ObjectMapper objectMapper,
            SelfOrderEventRecorder selfOrderEventRecorder,
            SelfOrderEventRepository selfOrderEventRepository) {
        this.hotelRepository = hotelRepository;
        this.inventoryDepotRepository = inventoryDepotRepository;
        this.depotProductRepository = depotProductRepository;
        this.selfServiceOrderRepository = selfServiceOrderRepository;
        this.tenantAccessService = tenantAccessService;
        this.chargeService = chargeService;
        this.reservationRepository = reservationRepository;
        this.pushSubscriptionRepository = pushSubscriptionRepository;
        this.notificationService = notificationService;
        this.selfOrderNotifyProperties = selfOrderNotifyProperties;
        this.selfOrderIdempotencyRepository = selfOrderIdempotencyRepository;
        this.objectMapper = objectMapper;
        this.selfOrderEventRecorder = selfOrderEventRecorder;
        this.selfOrderEventRepository = selfOrderEventRepository;
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
        List<DepotProduct> products = depotProductRepository.search(hotelId, null, true);
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
        return new SelfOrderDtos.PublicMenuResponse(
                hotel.getCurrency(),
                boardKey,
                depotRows,
                items,
                hotel.getName(),
                hotel.isSelfOrderSmsEnabled(),
                hotel.isSelfOrderPushEnabled());
    }

    /**
     * “Today” aggregates use the hotel’s {@link Hotel#getTimezone()} IANA id (default UTC): window is
     * {@code [localStartOfDay, localStartOfNextDay)} converted to instants.
     */
    @Transactional(readOnly = true)
    public SelfOrderDtos.PublicPortalSummary publicPortalSummary(UUID hotelId) {
        assertHotelExists(hotelId);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String tz = hotel.getTimezone();
        ZoneId zone = ZoneId.of(tz != null && !tz.isBlank() ? tz : "UTC");
        ZonedDateTime startZ = ZonedDateTime.now(zone).toLocalDate().atStartOfDay(zone);
        Instant from = startZ.toInstant();
        Instant to = startZ.plusDays(1).toInstant();

        long todayCount =
                selfServiceOrderRepository.countByHotel_IdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        hotelId, from, to);
        BigDecimal revenue = selfServiceOrderRepository.sumPaidTotalBetween(
                hotelId, from, to, SelfOrderPaymentStatus.PAID);
        if (revenue == null) {
            revenue = BigDecimal.ZERO;
        }
        revenue = revenue.setScale(2, RoundingMode.HALF_UP);

        List<SelfServiceOrder> completed =
                selfServiceOrderRepository.findByHotel_IdAndStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        hotelId, SelfOrderStatus.COMPLETED, from, to);
        Integer avgMin = null;
        if (!completed.isEmpty()) {
            long totalSec = 0;
            int n = 0;
            for (SelfServiceOrder o : completed) {
                Instant c = o.getCreatedAt();
                Instant u = o.getUpdatedAt();
                if (c != null && u != null) {
                    long sec = Duration.between(c, u).getSeconds();
                    if (sec >= 0 && sec < 48L * 3600) {
                        totalSec += sec;
                        n++;
                    }
                }
            }
            if (n > 0) {
                avgMin = (int) Math.round((totalSec / (double) n) / 60.0);
            }
        }

        List<SelfServiceOrder> active = selfServiceOrderRepository.findActiveOrdersWithLines(
                hotelId,
                List.of(SelfOrderStatus.PLACED, SelfOrderStatus.IN_PROGRESS, SelfOrderStatus.READY),
                PageRequest.of(0, 40));
        List<SelfOrderDtos.PublicActiveOrderBrief> briefs = new ArrayList<>();
        for (SelfServiceOrder o : active) {
            String callName = o.getPickupDisplayName();
            if (callName != null) {
                callName = callName.trim();
                if (callName.isEmpty()) {
                    callName = null;
                }
            }
            briefs.add(new SelfOrderDtos.PublicActiveOrderBrief(
                    o.getDisplayCode(),
                    o.getStatus().name(),
                    shortenSummary(activeLineSummary(o), 160),
                    callName));
        }
        return new SelfOrderDtos.PublicPortalSummary(todayCount, revenue, avgMin, briefs);
    }

    private static String activeLineSummary(SelfServiceOrder o) {
        if (o.getLines() == null || o.getLines().isEmpty()) {
            return "";
        }
        return o.getLines().stream()
                .sorted(Comparator.comparing(SelfServiceOrderLine::getLineOrder))
                .limit(5)
                .map(SelfOrderService::formatActiveLineBit)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(", "));
    }

    private static String formatActiveLineBit(SelfServiceOrderLine l) {
        String nm = l.getProduct() != null ? l.getProduct().getProductName() : "?";
        BigDecimal q = l.getQuantity();
        if (q != null && q.compareTo(BigDecimal.ONE) > 0) {
            return nm + " ×" + q.stripTrailingZeros().toPlainString();
        }
        return nm;
    }

    private static String shortenSummary(String s, int max) {
        if (s == null) {
            return "";
        }
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max - 1) + "…";
    }

    private record ResolvedLine(SelfOrderDtos.CreateLineInput line, DepotProduct product) {}

    private record PickupContext(String displayName, String location, String smsPhone, String smsConsentVersion) {}

    /**
     * Trim, strip controls, collapse spaces, cap length, and drop obvious abuse (URLs, markup noise, labels with no
     * letters or digits).
     */
    private static String sanitizePickupLabel(String raw, int maxLen) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        if (s.isEmpty()) {
            return null;
        }
        s = s.replaceAll("\\p{Cntrl}+", "");
        s = s.replaceAll("\\s+", " ").trim();
        if (s.isEmpty()) {
            return null;
        }
        if (s.length() > maxLen) {
            s = s.substring(0, maxLen);
        }
        String lower = s.toLowerCase(Locale.ROOT);
        if (lower.contains("http://")
                || lower.contains("https://")
                || lower.contains("<script")
                || lower.contains("javascript:")) {
            return null;
        }
        boolean hasLetterOrDigit = s.codePoints().anyMatch(cp -> Character.isLetter(cp) || Character.isDigit(cp));
        if (!hasLetterOrDigit) {
            return null;
        }
        return s;
    }

    private static PickupContext normalizePickup(SelfOrderDtos.CreatePublicOrderRequest req) {
        String name = sanitizePickupLabel(req.pickupDisplayName(), 64);
        String loc = sanitizePickupLabel(req.pickupLocation(), 48);
        String phone = req.smsNotifyPhone() == null ? null : req.smsNotifyPhone().trim().replaceAll("\\s+", "");
        if (phone != null && phone.isEmpty()) {
            phone = null;
        }
        if (phone != null) {
            if (phone.length() > 24 || !phone.matches("[+0-9]{8,24}")) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_SMS_PHONE",
                        "sms_notify_phone must be E.164 style (digits, optional leading +), 8–24 characters");
            }
            if (!Boolean.TRUE.equals(req.smsConsentAccepted())) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "SMS_CONSENT_REQUIRED",
                        "sms_consent_accepted must be true when sms_notify_phone is set");
            }
        }
        String consentVer = req.smsConsentVersion() == null ? null : req.smsConsentVersion().trim();
        if (consentVer != null && consentVer.length() > 16) {
            consentVer = consentVer.substring(0, 16);
        }
        if (phone != null && (consentVer == null || consentVer.isEmpty())) {
            consentVer = "1";
        }
        return new PickupContext(name, loc, phone, consentVer);
    }

    @Transactional
    public SelfOrderDtos.CreatePublicOrderResponse createPublicOrder(
            UUID hotelId, SelfOrderDtos.CreatePublicOrderRequest req, String idempotencyKeyHeader) {
        assertHotelExists(hotelId);
        if (idempotencyKeyHeader != null && !idempotencyKeyHeader.isBlank()) {
            String hash = sha256Hex(hotelId + ":" + idempotencyKeyHeader.trim());
            var cached = selfOrderIdempotencyRepository.findByHotel_IdAndKeyHash(hotelId, hash);
            if (cached.isPresent() && cached.get().getExpiresAt().isAfter(Instant.now())) {
                try {
                    return objectMapper.readValue(
                            cached.get().getResponseJson(), SelfOrderDtos.CreatePublicOrderResponse.class);
                } catch (Exception e) {
                    throw new ApiException(
                            HttpStatus.INTERNAL_SERVER_ERROR,
                            "IDEMPOTENCY_REPLAY_FAILED",
                            "Could not replay stored response for this Idempotency-Key");
                }
            }
        }
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        SelfOrderServiceType serviceType = parseServiceType(req.serviceType());
        PaymentMode mode = parsePaymentMode(req.paymentMode());
        if (mode == PaymentMode.CHARGE_ROOM && (req.roomCharge() == null)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "ROOM_CHARGE_REQUIRED",
                    "room_charge with roomNumber and bookingCode is required when paymentMode is CHARGE_ROOM");
        }

        String note = req.customerNote() == null ? null : req.customerNote().trim();
        if (note != null && note.length() > 280) {
            note = note.substring(0, 280);
        }
        if (note != null && note.isEmpty()) {
            note = null;
        }

        PickupContext pickup = normalizePickup(req);

        List<ResolvedLine> resolved = resolveSelfOrderLines(hotelId, req.lines());
        LinkedHashMap<UUID, List<ResolvedLine>> byDepot = new LinkedHashMap<>();
        for (ResolvedLine rl : resolved) {
            UUID did = rl.product().getDepot().getId();
            byDepot.computeIfAbsent(did, k -> new ArrayList<>()).add(rl);
        }

        UUID requestedDepot = req.depotId();
        if (requestedDepot != null) {
            if (byDepot.size() > 1) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "MULTI_DEPOT_CART",
                        "Cart spans multiple outlets: omit depotId or send one checkout per outlet.");
            }
            UUID onlyDepot = byDepot.keySet().iterator().next();
            if (!onlyDepot.equals(requestedDepot)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "depotId does not match the depot for these products");
            }
        }

        Reservation roomReservation = null;
        if (mode == PaymentMode.CHARGE_ROOM) {
            SelfOrderDtos.RoomChargeVerification rc = req.roomCharge();
            roomReservation = reservationRepository
                    .findCheckedInByRoomNumberAndBookingOrConfirmation(
                            hotelId, ReservationStatus.CHECKED_IN, rc.roomNumber(), rc.bookingCode())
                    .orElseThrow(() -> new ApiException(
                            HttpStatus.NOT_FOUND,
                            "ROOM_CHARGE_NOT_FOUND",
                            "No checked-in reservation matches this room and booking/confirmation code."));
        }

        long seqBase = selfServiceOrderRepository.countByHotel_Id(hotelId) + 1;
        List<SelfServiceOrder> placed = new ArrayList<>();
        int seqOffset = 0;
        for (List<ResolvedLine> group : byDepot.values()) {
            UUID depotId = group.get(0).product().getDepot().getId();
            InventoryDepot depot =
                    inventoryDepotRepository.findByIdAndHotel_Id(depotId, hotelId).orElseThrow(() -> notFound("Depot"));
            if (!depot.isActive()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Depot is not active: " + depot.getName());
            }
            SelfServiceOrder order = persistSelfOrderForDepot(
                    hotelId,
                    hotel,
                    depot,
                    group,
                    serviceType,
                    mode,
                    roomReservation,
                    note,
                    pickup,
                    orderNumberForSequence(seqBase + seqOffset));
            seqOffset++;
            placed.add(order);
        }

        SelfServiceOrder primary = placed.get(0);
        List<SelfOrderDtos.PlacedOrderRef> siblings = new ArrayList<>();
        for (int i = 1; i < placed.size(); i++) {
            SelfServiceOrder o = placed.get(i);
            siblings.add(new SelfOrderDtos.PlacedOrderRef(
                    o.getTrackToken(), o.getDisplayCode(), o.getOrderNumber(), o.getDepot().getName()));
        }

        String msg =
                placed.size() > 1
                        ? "Placed "
                                + placed.size()
                                + " outlet orders (one kitchen ticket each). "
                                + switch (mode) {
                                    case PAY_AT_COUNTER -> "Pay at counter; staff confirm payment before each ticket is released.";
                                    case CHARGE_ROOM -> "Each ticket was charged to your room folio.";
                                    case SIMULATED -> "All tickets are visible to kitchens.";
                                }
                        : switch (mode) {
                            case PAY_AT_COUNTER ->
                                    "Order placed — pay at counter; staff will confirm payment before the kitchen sees it.";
                            case CHARGE_ROOM -> "Order placed — charged to your room folio.";
                            case SIMULATED -> "Order placed";
                        };

        SelfOrderDtos.CreatePublicOrderResponse resp = new SelfOrderDtos.CreatePublicOrderResponse(
                primary.getId(),
                primary.getOrderNumber(),
                primary.getDisplayCode(),
                primary.getTrackToken(),
                primary.getServiceType().name(),
                primary.getStatus().name(),
                primary.getPaymentStatus().name(),
                primary.getPaymentMethod(),
                primary.getTotalAmount(),
                primary.getCreatedAt(),
                msg,
                siblings,
                primary.getPickupDisplayName(),
                primary.getPickupLocation());
        for (SelfServiceOrder o : placed) {
            selfOrderEventRecorder.record(
                    hotelId,
                    o.getId(),
                    SelfOrderEventRecorder.ORDER_PLACED,
                    Map.of(
                            "displayCode", o.getDisplayCode(),
                            "depot", o.getDepot().getName(),
                            "paymentMode", String.valueOf(mode)));
        }
        if (idempotencyKeyHeader != null && !idempotencyKeyHeader.isBlank()) {
            persistIdempotencyRow(hotelId, sha256Hex(hotelId + ":" + idempotencyKeyHeader.trim()), resp, primary.getTrackToken());
        }
        return resp;
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.WebPushPublicConfigResponse webPushPublicConfig(UUID hotelId) {
        assertHotelExists(hotelId);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        if (!hotel.isSelfOrderPushEnabled() || !selfOrderNotifyProperties.hasVapidKeys()) {
            return new SelfOrderDtos.WebPushPublicConfigResponse(false, null, null);
        }
        return new SelfOrderDtos.WebPushPublicConfigResponse(
                true,
                selfOrderNotifyProperties.getVapidPublicKey().trim(),
                selfOrderNotifyProperties.getVapidSubject().trim());
    }

    @Transactional
    public void subscribeWebPush(UUID hotelId, SelfOrderDtos.WebPushSubscribeRequest body) {
        assertHotelExists(hotelId);
        selfServiceOrderRepository
                .findByTrackTokenAndHotel_Id(body.trackToken(), hotelId)
                .orElseThrow(() -> notFound("Order"));
        String ep = body.endpoint().trim();
        if (ep.length() > 2048) {
            ep = ep.substring(0, 2048);
        }
        pushSubscriptionRepository.deleteByTrackTokenAndEndpoint(body.trackToken(), ep);
        pushSubscriptionRepository.flush();
        SelfOrderPushSubscription row = new SelfOrderPushSubscription();
        row.setHotel(hotelRepository.getReferenceById(hotelId));
        row.setTrackToken(body.trackToken());
        row.setEndpoint(ep);
        row.setP256dh(body.p256dh().trim());
        row.setAuthSecret(body.auth().trim());
        pushSubscriptionRepository.save(row);
        while (pushSubscriptionRepository.countByTrackToken(body.trackToken()) > 5) {
            var oldest = pushSubscriptionRepository.findByTrackTokenOrderByCreatedAtAsc(body.trackToken());
            if (oldest.isEmpty()) {
                break;
            }
            pushSubscriptionRepository.delete(oldest.get(0));
        }
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.BoardResponse pickupBoard(UUID hotelId, String boardKey) {
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        assertBoardKey(hotel, boardKey);
        List<SelfServiceOrder> rows = selfServiceOrderRepository.findForPickupBoard(
                hotelId, SelfOrderStatus.READY, SelfOrderPaymentStatus.PAID);
        SelfOrderDtos.BoardResponse board = mapOrdersToBoardResponse(rows);
        if (hotel.isPickupBoardHideGuestNames()) {
            return redactPickupDisplayNames(board);
        }
        return board;
    }

    /** Public pickup board only — strips guest call-out names; leaves codes, table/location, and lines. */
    private static SelfOrderDtos.BoardResponse redactPickupDisplayNames(SelfOrderDtos.BoardResponse in) {
        List<SelfOrderDtos.BoardOrderCard> out = new ArrayList<>();
        for (SelfOrderDtos.BoardOrderCard c : in.orders()) {
            out.add(new SelfOrderDtos.BoardOrderCard(
                    c.orderId(),
                    c.displayCode(),
                    c.serviceType(),
                    c.status(),
                    c.depotName(),
                    c.createdAt(),
                    null,
                    c.pickupLocation(),
                    c.lines()));
        }
        return new SelfOrderDtos.BoardResponse(out);
    }

    private List<ResolvedLine> resolveSelfOrderLines(UUID hotelId, List<SelfOrderDtos.CreateLineInput> lines) {
        List<ResolvedLine> out = new ArrayList<>();
        for (SelfOrderDtos.CreateLineInput line : lines) {
            if (line.quantity() == null || line.quantity().signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be positive");
            }
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(line.productId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            if (!p.isActive()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product is not available: " + p.getProductCode());
            }
            out.add(new ResolvedLine(line, p));
        }
        return out;
    }

    private SelfServiceOrder persistSelfOrderForDepot(
            UUID hotelId,
            Hotel hotel,
            InventoryDepot depot,
            List<ResolvedLine> resolvedLines,
            SelfOrderServiceType serviceType,
            PaymentMode mode,
            Reservation roomReservation,
            String customerNote,
            PickupContext pickup,
            String orderNumber) {
        SelfServiceOrder order = new SelfServiceOrder();
        order.setHotel(hotel);
        order.setDepot(depot);
        order.setOrderNumber(orderNumber);
        order.setDisplayCode(uniqueDisplayCode(hotelId));
        order.setTrackToken(UUID.randomUUID());
        order.setServiceType(serviceType);
        order.setStatus(SelfOrderStatus.PLACED);
        if (mode == PaymentMode.PAY_AT_COUNTER) {
            order.setPaymentStatus(SelfOrderPaymentStatus.UNPAID);
            order.setPaymentMethod("PAY_AT_COUNTER");
        } else if (mode == PaymentMode.CHARGE_ROOM) {
            order.setPaymentStatus(SelfOrderPaymentStatus.PAID);
            order.setPaymentMethod("ROOM_FOLIO");
        } else {
            order.setPaymentStatus(SelfOrderPaymentStatus.PAID);
            order.setPaymentMethod("SIMULATED");
        }
        order.setCustomerNote(customerNote);
        order.setPickupDisplayName(pickup.displayName());
        order.setPickupLocation(pickup.location());
        order.setSmsNotifyPhone(pickup.smsPhone());
        if (pickup.smsPhone() != null) {
            order.setSmsConsentVersion(pickup.smsConsentVersion());
            order.setSmsConsentAt(Instant.now());
        }

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        for (ResolvedLine rl : resolvedLines) {
            SelfOrderDtos.CreateLineInput line = rl.line();
            DepotProduct p = rl.product();
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
            sl.setModifiersNote(trimModifiersNote(line.modifiersNote()));
            order.getLines().add(sl);

            if ((mode == PaymentMode.SIMULATED || mode == PaymentMode.CHARGE_ROOM) && managedStock) {
                decrementStockWithRetry(p.getId(), line.quantity(), hotelId);
            }
        }
        order.setTotalAmount(scale2(total));
        if (mode == PaymentMode.CHARGE_ROOM) {
            String desc =
                    "Self-order "
                            + order.getDisplayCode()
                            + " ("
                            + order.getOrderNumber()
                            + ", "
                            + depot.getName()
                            + ")";
            chargeService.postFolioCharge(
                    hotelId,
                    roomReservation,
                    order.getTotalAmount(),
                    desc,
                    ChargeType.FNB,
                    "SELF_ORDER_KIOSK",
                    null,
                    null);
        }
        return selfServiceOrderRepository.save(order);
    }

    private static String orderNumberForSequence(long sequenceOneBased) {
        return "SO-" + Year.now().getValue() + "-" + String.format("%05d", sequenceOneBased);
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
        return mapOrdersToBoardResponse(rows);
    }

    private SelfOrderDtos.BoardResponse mapOrdersToBoardResponse(List<SelfServiceOrder> rows) {
        List<SelfOrderDtos.BoardOrderCard> cards = new ArrayList<>();
        for (SelfServiceOrder o : rows) {
            List<SelfOrderDtos.BoardLineBrief> lineBriefs = o.getLines().stream()
                    .sorted(Comparator.comparing(SelfServiceOrderLine::getLineOrder))
                    .map(l -> new SelfOrderDtos.BoardLineBrief(
                            l.getProduct().getProductName(),
                            l.getQuantity(),
                            l.getModifiersNote(),
                            l.getProduct().getPhotoUrl()))
                    .toList();
            cards.add(new SelfOrderDtos.BoardOrderCard(
                    o.getId(),
                    o.getDisplayCode(),
                    o.getServiceType().name(),
                    o.getStatus().name(),
                    o.getDepot().getName(),
                    o.getCreatedAt(),
                    o.getPickupDisplayName(),
                    o.getPickupLocation(),
                    lineBriefs));
        }
        return new SelfOrderDtos.BoardResponse(cards);
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.StaffSelfOrderSettings getSelfOrderSettings(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        boolean configured = hotel.getOrderBoardSecret() != null && !hotel.getOrderBoardSecret().isBlank();
        return new SelfOrderDtos.StaffSelfOrderSettings(
                configured,
                null,
                hotel.isPickupBoardHideGuestNames(),
                hotel.isSelfOrderSmsEnabled(),
                hotel.isSelfOrderPushEnabled());
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
        if (req.pickupBoardHideGuestNames() != null) {
            hotel.setPickupBoardHideGuestNames(Boolean.TRUE.equals(req.pickupBoardHideGuestNames()));
        }
        if (req.selfOrderSmsEnabled() != null) {
            hotel.setSelfOrderSmsEnabled(Boolean.TRUE.equals(req.selfOrderSmsEnabled()));
        }
        if (req.selfOrderPushEnabled() != null) {
            hotel.setSelfOrderPushEnabled(Boolean.TRUE.equals(req.selfOrderPushEnabled()));
        }
        hotelRepository.save(hotel);
        boolean configured = hotel.getOrderBoardSecret() != null && !hotel.getOrderBoardSecret().isBlank();
        return new SelfOrderDtos.StaffSelfOrderSettings(
                configured,
                echo,
                hotel.isPickupBoardHideGuestNames(),
                hotel.isSelfOrderSmsEnabled(),
                hotel.isSelfOrderPushEnabled());
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
                decrementStockWithRetry(p.getId(), sl.getQuantity(), hotelId);
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
        boolean becameReady = next == SelfOrderStatus.READY && cur != SelfOrderStatus.READY;
        order.setStatus(next);
        order.setUpdatedAt(Instant.now());
        selfServiceOrderRepository.save(order);
        SelfServiceOrder fresh = selfServiceOrderRepository
                .findFetchedByIdAndHotel_Id(orderId, hotelId)
                .orElse(order);
        selfOrderEventRecorder.record(
                hotelId,
                orderId,
                SelfOrderEventRecorder.ORDER_STATUS_CHANGED,
                Map.of("from", cur.name(), "to", next.name(), "displayCode", fresh.getDisplayCode()));
        if (becameReady) {
            notificationService.dispatchOrderReady(fresh);
        }
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
        return SelfOrderStatusRules.isAllowedTransition(from, to);
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
                o.getPickupDisplayName(),
                o.getPickupLocation(),
                o.getLastNotifyAt(),
                o.getLastNotifyStatus(),
                o.getLastNotifyDetail(),
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
                o.getPickupDisplayName(),
                o.getPickupLocation(),
                lineTrackRows(o));
    }

    private List<SelfOrderDtos.TrackLineRow> lineTrackRows(SelfServiceOrder o) {
        return o.getLines().stream()
                .sorted(Comparator.comparing(SelfServiceOrderLine::getLineOrder))
                .map(l -> new SelfOrderDtos.TrackLineRow(
                        l.getProduct().getProductName(),
                        l.getProduct().getProductCode(),
                        l.getQuantity(),
                        l.getLineTotal(),
                        l.getModifiersNote(),
                        l.getProduct().getPhotoUrl()))
                .toList();
    }

    private static String trimModifiersNote(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        if (t.isEmpty()) return null;
        return t.length() > 280 ? t.substring(0, 280) : t;
    }

    private void assertHotelExists(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw notFound("Hotel");
        }
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte b : d) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void persistIdempotencyRow(
            UUID hotelId, String keyHash, SelfOrderDtos.CreatePublicOrderResponse resp, UUID primaryTrack) {
        try {
            SelfOrderIdempotency row = new SelfOrderIdempotency();
            row.setId(UUID.randomUUID());
            row.setHotel(hotelRepository.getReferenceById(hotelId));
            row.setKeyHash(keyHash);
            row.setResponseJson(objectMapper.writeValueAsString(resp));
            row.setPrimaryTrackToken(primaryTrack);
            Instant now = Instant.now();
            row.setCreatedAt(now);
            row.setExpiresAt(now.plusSeconds(86_400));
            selfOrderIdempotencyRepository.save(row);
        } catch (DataIntegrityViolationException dup) {
            /* concurrent duplicate submit — another request won the unique slot */
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private void decrementStockWithRetry(UUID productId, BigDecimal qty, UUID hotelId) {
        for (int attempt = 0; attempt < 6; attempt++) {
            try {
                DepotProduct cur = depotProductRepository.findByIdAndHotel_Id(productId, hotelId).orElseThrow();
                if (!isManagedStockType(cur.getStockType())) {
                    return;
                }
                if (cur.getStockQty().compareTo(qty) < 0) {
                    throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + cur.getProductCode());
                }
                cur.setStockQty(cur.getStockQty().subtract(qty).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(cur);
                return;
            } catch (ObjectOptimisticLockingFailureException e) {
                if (attempt == 5) {
                    throw new ApiException(HttpStatus.CONFLICT, "Stock contention — please retry.");
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public SelfOrderDtos.SelfOrderHealthSnapshot selfOrderHealth(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String tz = hotel.getTimezone();
        ZoneId zone = ZoneId.of(tz != null && !tz.isBlank() ? tz : "UTC");
        Instant windowStart = ZonedDateTime.now(zone).toLocalDate().atStartOfDay(zone).toInstant();
        long total = selfOrderEventRepository.countAllSince(hotelId, windowStart);
        long placed = selfOrderEventRepository.countByHotelAndTypeSince(
                hotelId, windowStart, SelfOrderEventRecorder.ORDER_PLACED);
        long smsOk = selfOrderEventRepository.countByHotelAndTypeSince(
                hotelId, windowStart, SelfOrderEventRecorder.NOTIFY_SMS_OK);
        long smsFail = selfOrderEventRepository.countByHotelAndTypeSince(
                hotelId, windowStart, SelfOrderEventRecorder.NOTIFY_SMS_FAIL);
        long pushOk = selfOrderEventRepository.countByHotelAndTypeSince(
                hotelId, windowStart, SelfOrderEventRecorder.NOTIFY_PUSH_OK);
        long pushFail = selfOrderEventRepository.countByHotelAndTypeSince(
                hotelId, windowStart, SelfOrderEventRecorder.NOTIFY_PUSH_FAIL);
        return new SelfOrderDtos.SelfOrderHealthSnapshot(
                windowStart, total, placed, smsOk, smsFail, pushOk, pushFail);
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

    private enum PaymentMode {
        SIMULATED,
        PAY_AT_COUNTER,
        CHARGE_ROOM
    }

    private static PaymentMode parsePaymentMode(String raw) {
        if (raw == null || raw.isBlank()) {
            return PaymentMode.SIMULATED;
        }
        String v = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if ("PAY_AT_COUNTER".equals(v)) {
            return PaymentMode.PAY_AT_COUNTER;
        }
        if ("CHARGE_ROOM".equals(v)
                || "ROOM_CHARGE".equals(v)
                || "CHARGE_TO_ROOM".equals(v)
                || "ROOM".equals(v)) {
            return PaymentMode.CHARGE_ROOM;
        }
        if ("SIMULATED".equals(v) || "SIMULATE".equals(v)) {
            return PaymentMode.SIMULATED;
        }
        throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "paymentMode must be SIMULATED, PAY_AT_COUNTER, or CHARGE_ROOM (charge to checked-in guest folio)");
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
