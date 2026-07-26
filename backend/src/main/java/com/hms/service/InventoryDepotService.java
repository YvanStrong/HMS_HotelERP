package com.hms.service;

import com.hms.api.dto.InventoryDepotDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.DepotType;
import com.hms.domain.ReservationStatus;
import com.hms.domain.StockTransactionType;
import com.hms.entity.AppUser;
import com.hms.entity.DepotProduct;
import com.hms.entity.DepotSale;
import com.hms.entity.DepotSaleLine;
import com.hms.entity.DepotSaleRefund;
import com.hms.entity.DepotSaleRefundLine;
import com.hms.entity.Hotel;
import com.hms.entity.InvWarehouse;
import com.hms.entity.InventoryDepot;
import com.hms.entity.InventoryItem;
import com.hms.entity.PosProforma;
import com.hms.entity.PosProformaLine;
import com.hms.entity.PosDeliveryOrder;
import com.hms.entity.PosDeliveryOrderLine;
import com.hms.entity.Promotion;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.entity.StockTransaction;
import com.hms.repository.AppUserRepository;
import com.hms.repository.DepotProductRepository;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.DepotSaleRefundRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InvWarehouseRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.repository.PosProformaRepository;
import com.hms.repository.PosDeliveryOrderRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.StockTransactionRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryDepotService {

    private static final List<DepotSeed> DEFAULT_DEPOTS = List.of(
            new DepotSeed("Restaurant", "REST", DepotType.RESTAURANT),
            new DepotSeed("Bar", "BAR", DepotType.BAR),
            new DepotSeed("Cuisine", "CUIS", DepotType.CUISINE),
            new DepotSeed("Principal", "PRINC", DepotType.PRINCIPAL),
            new DepotSeed("Barista", "BARISTA", DepotType.BARISTA),
            new DepotSeed("Patisry", "PAT", DepotType.PATISSERIE));

    private final TenantAccessService tenantAccessService;
    private final InventoryDepotRepository inventoryDepotRepository;
    private final DepotProductRepository depotProductRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final DepotSaleRefundRepository depotSaleRefundRepository;
    private final PosProformaRepository posProformaRepository;
    private final PosDeliveryOrderRepository posDeliveryOrderRepository;
    private final HotelRepository hotelRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final InvWarehouseRepository invWarehouseRepository;
    private final StockTransactionRepository stockTransactionRepository;
    private final ReservationRepository reservationRepository;
    private final ChargeService chargeService;
    private final AppUserRepository appUserRepository;
    private final PosOrderNotificationService posOrderNotificationService;
    private final DynamicPricingService dynamicPricingService;

    @org.springframework.context.annotation.Lazy
    @org.springframework.beans.factory.annotation.Autowired
    private EbmSaleEventService ebmSaleEventService;

    public InventoryDepotService(
            TenantAccessService tenantAccessService,
            InventoryDepotRepository inventoryDepotRepository,
            DepotProductRepository depotProductRepository,
            DepotSaleRepository depotSaleRepository,
            DepotSaleRefundRepository depotSaleRefundRepository,
            PosProformaRepository posProformaRepository,
            PosDeliveryOrderRepository posDeliveryOrderRepository,
            HotelRepository hotelRepository,
            InventoryItemRepository inventoryItemRepository,
            InvWarehouseRepository invWarehouseRepository,
            StockTransactionRepository stockTransactionRepository,
            ReservationRepository reservationRepository,
            ChargeService chargeService,
            AppUserRepository appUserRepository,
            PosOrderNotificationService posOrderNotificationService,
            DynamicPricingService dynamicPricingService) {
        this.tenantAccessService = tenantAccessService;
        this.inventoryDepotRepository = inventoryDepotRepository;
        this.depotProductRepository = depotProductRepository;
        this.depotSaleRepository = depotSaleRepository;
        this.depotSaleRefundRepository = depotSaleRefundRepository;
        this.posProformaRepository = posProformaRepository;
        this.posDeliveryOrderRepository = posDeliveryOrderRepository;
        this.hotelRepository = hotelRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.invWarehouseRepository = invWarehouseRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.reservationRepository = reservationRepository;
        this.chargeService = chargeService;
        this.appUserRepository = appUserRepository;
        this.posOrderNotificationService = posOrderNotificationService;
        this.dynamicPricingService = dynamicPricingService;
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.DepotRow> listDepots(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return inventoryDepotRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(this::toRow)
                .toList();
    }

    /**
     * For each active menu outlet (depot), ensures an {@link InvWarehouse} exists with the matching
     * store code and links the depot. Outlet code {@code PRINC} maps to warehouse {@code PRINCIPAL}.
     * Custom outlets (e.g. {@code BAR01}, {@code PRDR01}) become their own warehouse rows so branches
     * / transfers lists stay aligned with Menu.
     */
    @Transactional
    public void syncWarehousesFromDepots(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        final boolean[] noDefaultPrincipal = {
            invWarehouseRepository.findByHotel_IdAndIsDefaultTrue(hotelId).isEmpty()
        };

        for (InventoryDepot d : inventoryDepotRepository.findByHotel_IdOrderByNameAsc(hotelId)) {
            if (!d.isActive()) {
                continue;
            }
            String whCode = warehouseCodeForDepot(d);
            if (whCode.isBlank()) {
                continue;
            }
            InvWarehouse w = invWarehouseRepository
                    .findByHotel_IdAndCodeIgnoreCase(hotelId, whCode)
                    .orElseGet(() -> {
                        InvWarehouse nw = new InvWarehouse();
                        nw.setHotel(hotel);
                        nw.setName(warehouseDisplayNameForDepot(d, whCode));
                        nw.setCode(whCode);
                        nw.setAddress(null);
                        boolean setDefault = "PRINCIPAL".equals(whCode) && noDefaultPrincipal[0];
                        nw.setDefault(setDefault);
                        nw.setActive(true);
                        InvWarehouse saved = invWarehouseRepository.save(nw);
                        if (setDefault) {
                            noDefaultPrincipal[0] = false;
                        }
                        return saved;
                    });
            if (d.getLinkedWarehouse() == null
                    || !d.getLinkedWarehouse().getId().equals(w.getId())) {
                d.setLinkedWarehouse(w);
                inventoryDepotRepository.save(d);
            }
        }
    }

    private static String warehouseCodeForDepot(InventoryDepot d) {
        String raw = d.getCode() == null ? "" : d.getCode().trim().toUpperCase(Locale.ROOT);
        if (raw.isBlank()) {
            return "";
        }
        if ("PRINC".equals(raw)) {
            return "PRINCIPAL";
        }
        return raw.length() > 32 ? raw.substring(0, 32) : raw;
    }

    private static String warehouseDisplayNameForDepot(InventoryDepot d, String whCode) {
        if ("PRINCIPAL".equals(whCode)) {
            return "Principal";
        }
        String n = d.getName() == null ? "" : d.getName().trim();
        return n.isBlank() ? whCode : n;
    }

    @Transactional
    public List<InventoryDepotDtos.DepotRow> bootstrapDefaults(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        for (DepotSeed seed : DEFAULT_DEPOTS) {
            if (inventoryDepotRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, seed.code())) {
                continue;
            }
            InventoryDepot d = new InventoryDepot();
            d.setHotel(hotel);
            d.setName(seed.name());
            d.setCode(seed.code());
            d.setDepotType(seed.type());
            inventoryDepotRepository.save(d);
        }
        syncWarehousesFromDepots(hotelId, hotelHeader);
        return listDepots(hotelId, hotelHeader);
    }

    @Transactional
    public InventoryDepotDtos.CreateDepotResponse createDepot(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateDepotRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String code = (req.code() == null || req.code().isBlank()) ? normalizeCode(req.name()) : normalizeCode(req.code());
        if (inventoryDepotRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Depot code already exists: " + code);
        }
        InventoryDepot d = new InventoryDepot();
        d.setHotel(hotel);
        d.setName(req.name().trim());
        d.setCode(code);
        d.setDepotType(parseDepotType(req.depotType()));
        d = inventoryDepotRepository.save(d);
        syncWarehousesFromDepots(hotelId, hotelHeader);
        return new InventoryDepotDtos.CreateDepotResponse(
                d.getId(), d.getName(), d.getCode(), d.getDepotType().name(), "Depot created");
    }

    @Transactional
    public InventoryDepotDtos.CreateDepotProductResponse createProduct(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateDepotProductRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));

        String cleanName = req.productName().trim();
        int nextNumber = depotProductRepository.findMaxProductNumber(hotelId) + 1;
        String code = nextProductCode(hotelId, cleanName);

        DepotProduct p = new DepotProduct();
        p.setHotel(hotel);
        p.setDepot(depot);
        p.setProductNumber(nextNumber);
        p.setProductName(cleanName);
        p.setProductCode(code);
        p.setBatchNo(req.batchNo() == null || req.batchNo().isBlank() ? "NA" : req.batchNo().trim());
        p.setExpiryDate(req.expiryDate());
        p.setCostPrice(scale2(req.costPrice()));
        p.setSellingPrice(scale2(req.sellingPrice()));
        String stockType = parseStockType(req.stockType());
        p.setStockType(stockType);
        if ("NON_STOCK".equals(stockType)) {
            p.setStockQty(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));
        } else {
            p.setStockQty(req.stockQty() == null ? BigDecimal.ZERO : req.stockQty().setScale(3, RoundingMode.HALF_UP));
        }
        p.setPhotoUrl(req.photoUrl());
        p.setMenuName(normalizeMenuName(req.menuName()));
        p.setTaxable(req.taxable() == null || Boolean.TRUE.equals(req.taxable()));
        if (req.inventoryItemId() != null) {
            InventoryItem ii = inventoryItemRepository
                    .findByIdAndHotel_Id(req.inventoryItemId(), hotelId)
                    .orElseThrow(() -> notFound("Inventory item"));
            if (depotProductRepository.existsByHotel_IdAndDepot_IdAndInventoryItem_Id(hotelId, depot.getId(), ii.getId())) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "This inventory item is already on this outlet’s menu. Refresh the page.");
            }
            p.setInventoryItem(ii);
        }
        p = depotProductRepository.save(p);
        return new InventoryDepotDtos.CreateDepotProductResponse(
                p.getId(), p.getProductNumber(), p.getProductCode(), "Depot product created", toProductRow(p));
    }

    @Transactional
    public InventoryDepotDtos.DepotProductRow patchProduct(
            UUID hotelId, String hotelHeader, UUID productId, InventoryDepotDtos.PatchDepotProductRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.productName() == null
                && req.batchNo() == null
                && req.expiryDate() == null
                && req.costPrice() == null
                && req.sellingPrice() == null
                && req.stockQty() == null
                && req.stockType() == null
                && req.photoUrl() == null
                && req.menuName() == null
                && req.taxable() == null
                && req.active() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provide at least one field to update");
        }
        DepotProduct p = depotProductRepository
                .findByIdAndHotel_Id(productId, hotelId)
                .orElseThrow(() -> notFound("Product"));
        if (req.productName() != null) {
            String name = req.productName().trim();
            if (name.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "productName cannot be blank");
            p.setProductName(name);
        }
        if (req.batchNo() != null) {
            p.setBatchNo(req.batchNo().isBlank() ? "NA" : req.batchNo().trim());
        }
        if (req.expiryDate() != null) {
            p.setExpiryDate(req.expiryDate());
        }
        if (req.costPrice() != null) {
            p.setCostPrice(scale2(req.costPrice()));
        }
        if (req.sellingPrice() != null) {
            p.setSellingPrice(scale2(req.sellingPrice()));
        }
        if (req.photoUrl() != null) {
            p.setPhotoUrl(req.photoUrl().isBlank() ? null : req.photoUrl().trim());
        }
        if (req.menuName() != null) {
            p.setMenuName(normalizeMenuName(req.menuName()));
        }
        if (req.taxable() != null) {
            p.setTaxable(req.taxable());
        }
        if (req.active() != null) {
            p.setActive(req.active());
        }
        if (req.stockType() != null && !req.stockType().isBlank()) {
            String stockType = parseStockType(req.stockType());
            p.setStockType(stockType);
            if ("NON_STOCK".equals(stockType)) {
                p.setStockQty(BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));
            }
        }
        if (req.stockQty() != null) {
            if (!isManagedStockType(p.getStockType())) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "stockQty applies only to STOCK products; set stockType to STOCK first (or omit stockQty for NON_STOCK).");
            }
            p.setStockQty(req.stockQty().setScale(3, RoundingMode.HALF_UP));
        }
        p = depotProductRepository.save(p);
        return toProductRow(p);
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.DepotProductRow> listProducts(
            UUID hotelId, String hotelHeader, UUID depotId, String menuName, boolean activeOnly) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String menu = menuName != null && !menuName.isBlank() ? normalizeMenuName(menuName) : null;
        return depotProductRepository.search(hotelId, depotId, activeOnly).stream()
                .filter(p -> menu == null || menu.equalsIgnoreCase(p.getMenuName()))
                .map(this::toProductRow)
                .toList();
    }

    @Transactional
    public InventoryDepotDtos.CreateSaleResponse createSale(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateSaleRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));

        DepotSale sale = new DepotSale();
        sale.setHotel(hotel);
        sale.setDepot(depot);
        sale.setSaleNumber(nextSaleNumber(hotelId));
        sale.setCustomerName(req.customerName() == null ? null : req.customerName().trim());
        sale.setPaymentMethod(normalizePaymentMethod(req.paymentMethod()));
        sale.setCreatedBy(tenantAccessService.currentUser().getUsername());
        applyMobileSaleFields(sale, req, hotelId);

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        List<InventoryDepotDtos.SaleLineRow> responseLines = new ArrayList<>();

        for (InventoryDepotDtos.SaleLineInput line : req.lines()) {
            if (line.quantity() == null || line.quantity().signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be positive");
            }
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(line.productId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            if (!p.getDepot().getId().equals(depot.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product does not belong to selected depot");
            }
            boolean managedStock = isManagedStockType(p.getStockType());
            if (managedStock && p.getStockQty().compareTo(line.quantity()) < 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + p.getProductCode());
            }
            BigDecimal unitPrice = resolveLineUnitPrice(line, p);
            BigDecimal lineTotal = scale2(unitPrice.multiply(line.quantity()));
            total = total.add(lineTotal);

            DepotSaleLine sl = new DepotSaleLine();
            sl.setSale(sale);
            sl.setProduct(p);
            sl.setLineOrder(lineOrder++);
            sl.setQuantity(line.quantity().setScale(3, RoundingMode.HALF_UP));
            sl.setUnitPrice(unitPrice);
            sl.setLineTotal(lineTotal);
            sl.setTaxable(p.isTaxable());
            if (line.notes() != null && !line.notes().isBlank()) {
                sl.setLineNotes(line.notes().trim());
            }
            sale.getLines().add(sl);

            if (managedStock) {
                p.setStockQty(p.getStockQty().subtract(line.quantity()).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(p);
                if (p.getInventoryItem() != null) {
                    InventoryItem ii = inventoryItemRepository
                            .findByIdAndHotel_Id(p.getInventoryItem().getId(), hotelId)
                            .orElseThrow(() -> notFound("Inventory item"));
                    if (ii.getCurrentStock().compareTo(line.quantity()) < 0) {
                        throw new ApiException(
                                HttpStatus.CONFLICT,
                                "Insufficient ERP stock for linked item " + ii.getSku());
                    }
                    ii.setCurrentStock(
                            ii.getCurrentStock().subtract(line.quantity()).setScale(4, RoundingMode.HALF_UP));
                    inventoryItemRepository.save(ii);
                    StockTransaction st = new StockTransaction();
                    st.setItem(ii);
                    st.setType(StockTransactionType.CONSUMPTION);
                    st.setQuantity(line.quantity());
                    st.setReference("MENU_SALE:" + sale.getSaleNumber());
                    st.setNotes("Menu / outlet sale @ " + depot.getName());
                    st.setPerformedBy(tenantAccessService.currentUser().getUsername());
                    st.setFromLocation(depot.getName());
                    stockTransactionRepository.save(st);
                }
            }

            responseLines.add(new InventoryDepotDtos.SaleLineRow(
                    p.getProductName(),
                    p.getProductCode(),
                    sl.getQuantity(),
                    sl.getUnitPrice(),
                    sl.getLineTotal(),
                    sl.isTaxable()));
        }
        sale.setTotalAmount(scale2(total));
        applyPromotionToSale(hotelId, sale, scale2(total), req.promoCode());
        applyForeignCurrencyPayment(sale, req);
        sale = depotSaleRepository.save(sale);
        RoomCharge folioCharge = null;
        if (Boolean.TRUE.equals(req.chargeToRoom())) {
            if (req.reservationId() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "reservationId is required when chargeToRoom is true");
            }
            Reservation reservation = reservationRepository
                    .findByIdAndHotel_Id(req.reservationId(), hotelId)
                    .orElseThrow(() -> notFound("Reservation"));
            if (reservation.getStatus() != ReservationStatus.CHECKED_IN) {
                throw new ApiException(HttpStatus.CONFLICT, "Reservation must be CHECKED_IN to charge POS sale to folio");
            }
            folioCharge = chargeService.postFolioCharge(
                    hotelId,
                    reservation,
                    sale.getTotalAmount(),
                    "POS sale " + sale.getSaleNumber() + " @ " + depot.getName(),
                    ChargeType.FNB,
                    sale.getCreatedBy(),
                    "{\"depotSaleId\":\"" + sale.getId() + "\",\"saleNumber\":\"" + sale.getSaleNumber() + "\"}");
        }
        if (isMobilePosActivity(sale.getTableLabel(), sale.getStaffUser())) {
            posOrderNotificationService.publishSale(sale);
        }
        try {
            if (ebmSaleEventService != null) {
                ebmSaleEventService.enqueueDepotSale(hotelId, sale);
            }
        } catch (Exception ignored) {
            // EBM must never block POS checkout
        }
        return new InventoryDepotDtos.CreateSaleResponse(
                sale.getId(),
                sale.getSaleNumber(),
                depot.getId(),
                sale.getTotalAmount(),
                sale.getCreatedAt(),
                responseLines,
                folioCharge != null ? folioCharge.getId() : null,
                sale.getPaymentMethod(),
                "Sale completed",
                sale.getSubtotalAmount(),
                sale.getDiscountAmount(),
                sale.getPromoCode(),
                sale.getPaymentCurrency(),
                sale.getExchangeRate(),
                sale.getForeignAmount());
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.SaleRow> listSales(UUID hotelId, String hotelHeader, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return depotSaleRepository.findByHotelId(hotelId, depotId).stream()
                .map(s -> new InventoryDepotDtos.SaleRow(
                        s.getId(),
                        s.getSaleNumber(),
                        s.getDepot().getName(),
                        s.getCustomerName(),
                        s.getTotalAmount(),
                        s.getCreatedAt(),
                        s.getPaymentMethod(),
                        s.getStatus()))
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryDepotDtos.SaleDetailResponse getSaleDetail(UUID hotelId, String hotelHeader, UUID saleId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        DepotSale sale = depotSaleRepository
                .findFetchedByIdAndHotelId(saleId, hotelId)
                .or(() -> depotSaleRepository.findByIdAndHotel_Id(saleId, hotelId))
                .orElseThrow(() -> notFound("Sale"));
        List<InventoryDepotDtos.SaleLineRow> lineRows = sale.getLines().stream()
                .sorted(Comparator.comparing(DepotSaleLine::getLineOrder))
                .map(sl -> new InventoryDepotDtos.SaleLineRow(
                        sl.getProduct().getProductName(),
                        sl.getProduct().getProductCode(),
                        sl.getQuantity(),
                        sl.getUnitPrice(),
                        sl.getLineTotal(),
                        sl.isTaxable()))
                .toList();
        return new InventoryDepotDtos.SaleDetailResponse(
                sale.getId(),
                sale.getSaleNumber(),
                sale.getDepot().getName(),
                sale.getCustomerName(),
                sale.getTotalAmount(),
                sale.getCreatedAt(),
                sale.getPaymentMethod(),
                sale.getStatus(),
                lineRows,
                sale.getSubtotalAmount() != null ? sale.getSubtotalAmount() : sale.getTotalAmount(),
                sale.getDiscountAmount() != null ? sale.getDiscountAmount() : BigDecimal.ZERO,
                sale.getPromoCode(),
                sale.getPaymentCurrency(),
                sale.getExchangeRate(),
                sale.getForeignAmount());
    }

    @Transactional
    public InventoryDepotDtos.RefundResponse refundSaleFull(
            UUID hotelId, String hotelHeader, UUID saleId, InventoryDepotDtos.CreateRefundRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        DepotSale sale = depotSaleRepository
                .findForRefundByIdAndHotelId(saleId, hotelId)
                .orElseThrow(() -> notFound("Sale"));
        if ("REFUNDED".equalsIgnoreCase(sale.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Sale is already refunded");
        }
        if (depotSaleRefundRepository.existsBySale_IdAndHotel_Id(saleId, hotelId)) {
            throw new ApiException(HttpStatus.CONFLICT, "A refund already exists for this sale");
        }
        if (sale.getLines() == null || sale.getLines().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Sale has no lines to refund");
        }

        Hotel hotel = sale.getHotel();
        InventoryDepot depot = sale.getDepot();
        String who = tenantAccessService.currentUser().getUsername();

        DepotSaleRefund refund = new DepotSaleRefund();
        refund.setHotel(hotel);
        refund.setSale(sale);
        refund.setRefundNumber(nextRefundNumber(hotelId));
        refund.setRefundAmount(sale.getTotalAmount());
        refund.setRefundMethod(sale.getPaymentMethod());
        refund.setReason(req != null && req.reason() != null ? req.reason().trim() : null);
        refund.setCreatedBy(who);

        int lineOrder = 0;
        List<InventoryDepotDtos.RefundLineRow> responseLines = new ArrayList<>();
        for (DepotSaleLine sl : sale.getLines().stream()
                .sorted(Comparator.comparing(DepotSaleLine::getLineOrder))
                .toList()) {
            BigDecimal qty = sl.getQuantity();
            if (qty == null || qty.signum() <= 0) {
                continue;
            }
            restoreStockForRefundLine(hotelId, depot, sale, sl, qty, who);

            DepotSaleRefundLine rl = new DepotSaleRefundLine();
            rl.setRefund(refund);
            rl.setSaleLine(sl);
            rl.setProduct(sl.getProduct());
            rl.setQuantityRefunded(qty);
            rl.setUnitPrice(sl.getUnitPrice());
            rl.setLineTotal(sl.getLineTotal());
            rl.setLineOrder(lineOrder++);
            refund.getLines().add(rl);

            sl.setQuantityRefunded(qty.setScale(3, RoundingMode.HALF_UP));
            responseLines.add(new InventoryDepotDtos.RefundLineRow(
                    sl.getProduct().getProductName(),
                    sl.getProduct().getProductCode(),
                    rl.getQuantityRefunded(),
                    rl.getUnitPrice(),
                    rl.getLineTotal()));
        }

        sale.setStatus("REFUNDED");
        depotSaleRepository.save(sale);
        refund = depotSaleRefundRepository.save(refund);

        return new InventoryDepotDtos.RefundResponse(
                refund.getId(),
                refund.getRefundNumber(),
                sale.getId(),
                sale.getSaleNumber(),
                depot.getName(),
                sale.getCustomerName(),
                refund.getRefundAmount(),
                refund.getRefundMethod(),
                refund.getReason(),
                refund.getCreatedAt(),
                responseLines,
                "Refund completed — stock restored to " + depot.getName());
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.RefundRow> listRefunds(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return depotSaleRefundRepository.findByHotelIdOrderByCreatedAtDesc(hotelId).stream()
                .map(r -> new InventoryDepotDtos.RefundRow(
                        r.getId(),
                        r.getRefundNumber(),
                        r.getSale().getId(),
                        r.getSale().getSaleNumber(),
                        r.getSale().getDepot().getName(),
                        r.getSale().getCustomerName(),
                        r.getRefundAmount(),
                        r.getRefundMethod(),
                        r.getReason(),
                        r.getCreatedAt(),
                        r.getCreatedBy()))
                .toList();
    }

    private void restoreStockForRefundLine(
            UUID hotelId,
            InventoryDepot depot,
            DepotSale sale,
            DepotSaleLine sl,
            BigDecimal qty,
            String who) {
        DepotProduct p = depotProductRepository
                .findByIdAndHotel_Id(sl.getProduct().getId(), hotelId)
                .orElseThrow(() -> notFound("Product"));
        if (!isManagedStockType(p.getStockType())) {
            return;
        }
        p.setStockQty(p.getStockQty().add(qty).setScale(3, RoundingMode.HALF_UP));
        depotProductRepository.save(p);
        if (p.getInventoryItem() != null) {
            InventoryItem ii = inventoryItemRepository
                    .findByIdAndHotel_Id(p.getInventoryItem().getId(), hotelId)
                    .orElseThrow(() -> notFound("Inventory item"));
            ii.setCurrentStock(ii.getCurrentStock().add(qty).setScale(4, RoundingMode.HALF_UP));
            inventoryItemRepository.save(ii);
            StockTransaction st = new StockTransaction();
            st.setItem(ii);
            st.setType(StockTransactionType.ADJUSTMENT);
            st.setQuantity(qty);
            st.setReference("POS_REFUND:" + sale.getSaleNumber());
            st.setNotes("POS refund — stock restored @ " + depot.getName());
            st.setPerformedBy(who);
            st.setToLocation(depot.getName());
            stockTransactionRepository.save(st);
        }
    }

    @Transactional
    public InventoryDepotDtos.CreateDeliveryOrderResponse createDeliveryOrder(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateDeliveryOrderRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));

        PosDeliveryOrder order = new PosDeliveryOrder();
        order.setHotel(hotel);
        order.setDepot(depot);
        order.setDeliveryNumber(nextDeliveryNumber(hotelId));
        order.setCustomerName(req.customerName() == null ? null : req.customerName().trim());
        order.setLocationLabel(req.locationLabel() == null ? null : req.locationLabel().trim());
        order.setCreatedBy(tenantAccessService.currentUser().getUsername());
        resolveStaffUser(req.staffId(), hotelId).ifPresent(order::setStaffUser);

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        List<InventoryDepotDtos.SaleLineRow> responseLines = new ArrayList<>();
        for (InventoryDepotDtos.SaleLineInput line : req.lines()) {
            if (line.quantity() == null || line.quantity().signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be positive");
            }
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(line.productId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            if (!p.getDepot().getId().equals(depot.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product does not belong to selected depot");
            }
            BigDecimal unitPrice = resolveLineUnitPrice(line, p);
            BigDecimal lineTotal = scale2(unitPrice.multiply(line.quantity()));
            total = total.add(lineTotal);

            PosDeliveryOrderLine dl = new PosDeliveryOrderLine();
            dl.setDeliveryOrder(order);
            dl.setProduct(p);
            dl.setLineOrder(lineOrder++);
            dl.setQuantity(line.quantity().setScale(3, RoundingMode.HALF_UP));
            dl.setUnitPrice(unitPrice);
            dl.setLineTotal(lineTotal);
            dl.setTaxable(p.isTaxable());
            if (line.notes() != null && !line.notes().isBlank()) {
                dl.setLineNotes(line.notes().trim());
            }
            order.getLines().add(dl);

            responseLines.add(new InventoryDepotDtos.SaleLineRow(
                    p.getProductName(), p.getProductCode(), dl.getQuantity(), dl.getUnitPrice(), dl.getLineTotal(), dl.isTaxable()));
        }
        order.setTotalAmount(scale2(total));
        applyPromotionToDelivery(hotelId, order, scale2(total), req.promoCode());
        order = posDeliveryOrderRepository.save(order);
        if (isMobilePosActivity(order.getLocationLabel(), order.getStaffUser())) {
            posOrderNotificationService.publishDelivery(order);
        }
        return new InventoryDepotDtos.CreateDeliveryOrderResponse(
                order.getId(),
                order.getDeliveryNumber(),
                depot.getId(),
                order.getTotalAmount(),
                order.getCreatedAt(),
                responseLines,
                "Delivery order saved",
                order.getSubtotalAmount(),
                order.getDiscountAmount(),
                order.getPromoCode());
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.DeliveryOrderRow> listDeliveryOrders(UUID hotelId, String hotelHeader, String status) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String normalizedStatus = status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)
                ? null
                : status.trim().toUpperCase(Locale.ROOT);
        return posDeliveryOrderRepository.findByHotelId(hotelId, normalizedStatus).stream()
                .map(this::toDeliveryOrderRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryDepotDtos.DeliveryOrderDetailResponse getDeliveryOrderDetail(
            UUID hotelId, String hotelHeader, UUID orderId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosDeliveryOrder order = posDeliveryOrderRepository
                .findFetchedByIdAndHotelId(orderId, hotelId)
                .orElseThrow(() -> notFound("Delivery order"));
        return toDeliveryOrderDetail(order);
    }

    @Transactional
    public InventoryDepotDtos.CreateSaleResponse convertDeliveryToSale(UUID hotelId, String hotelHeader, UUID orderId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosDeliveryOrder order = posDeliveryOrderRepository
                .findFetchedByIdAndHotelId(orderId, hotelId)
                .orElseThrow(() -> notFound("Delivery order"));
        if (!"PENDING".equals(order.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Only pending delivery orders can be converted to invoice");
        }

        DepotSale sale = new DepotSale();
        sale.setHotel(order.getHotel());
        sale.setDepot(order.getDepot());
        sale.setSaleNumber(nextSaleNumber(hotelId));
        sale.setCustomerName(order.getCustomerName());
        sale.setPaymentMethod("CASH");
        sale.setCreatedBy(tenantAccessService.currentUser().getUsername());

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        List<InventoryDepotDtos.SaleLineRow> responseLines = new ArrayList<>();
        for (PosDeliveryOrderLine dl : order.getLines().stream()
                .sorted(Comparator.comparing(PosDeliveryOrderLine::getLineOrder))
                .toList()) {
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(dl.getProduct().getId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            BigDecimal qty = dl.getQuantity();
            boolean managedStock = isManagedStockType(p.getStockType());
            if (managedStock && p.getStockQty().compareTo(qty) < 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + p.getProductCode());
            }

            DepotSaleLine sl = new DepotSaleLine();
            sl.setSale(sale);
            sl.setProduct(p);
            sl.setLineOrder(lineOrder++);
            sl.setQuantity(qty.setScale(3, RoundingMode.HALF_UP));
            sl.setUnitPrice(scale2(dl.getUnitPrice()));
            sl.setLineTotal(scale2(dl.getLineTotal()));
            sl.setTaxable(dl.isTaxable());
            sale.getLines().add(sl);
            total = total.add(sl.getLineTotal());

            if (managedStock) {
                p.setStockQty(p.getStockQty().subtract(qty).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(p);
                if (p.getInventoryItem() != null) {
                    InventoryItem ii = inventoryItemRepository
                            .findByIdAndHotel_Id(p.getInventoryItem().getId(), hotelId)
                            .orElseThrow(() -> notFound("Inventory item"));
                    if (ii.getCurrentStock().compareTo(qty) < 0) {
                        throw new ApiException(HttpStatus.CONFLICT, "Insufficient ERP stock for linked item " + ii.getSku());
                    }
                    ii.setCurrentStock(ii.getCurrentStock().subtract(qty).setScale(4, RoundingMode.HALF_UP));
                    inventoryItemRepository.save(ii);
                    StockTransaction st = new StockTransaction();
                    st.setItem(ii);
                    st.setType(StockTransactionType.CONSUMPTION);
                    st.setQuantity(qty);
                    st.setReference("MENU_SALE:" + sale.getSaleNumber());
                    st.setNotes("Converted from delivery " + order.getDeliveryNumber());
                    st.setPerformedBy(tenantAccessService.currentUser().getUsername());
                    st.setFromLocation(order.getDepot().getName());
                    stockTransactionRepository.save(st);
                }
            }
            responseLines.add(new InventoryDepotDtos.SaleLineRow(
                    p.getProductName(), p.getProductCode(), sl.getQuantity(), sl.getUnitPrice(), sl.getLineTotal(), sl.isTaxable()));
        }

        sale.setTotalAmount(scale2(total));
        copyPromotionOntoSale(sale, order.getSubtotalAmount(), order.getDiscountAmount(), order.getPromoCode(), order.getPromotion());
        sale = depotSaleRepository.save(sale);
        order.setSale(sale);
        order.setStatus("INVOICED");
        order.setInvoicedAt(java.time.Instant.now());
        posDeliveryOrderRepository.save(order);
        return new InventoryDepotDtos.CreateSaleResponse(
                sale.getId(),
                sale.getSaleNumber(),
                order.getDepot().getId(),
                sale.getTotalAmount(),
                sale.getCreatedAt(),
                responseLines,
                null,
                sale.getPaymentMethod(),
                "Delivery converted to invoice",
                sale.getSubtotalAmount(),
                sale.getDiscountAmount(),
                sale.getPromoCode(),
                sale.getPaymentCurrency(),
                sale.getExchangeRate(),
                sale.getForeignAmount());
    }

    @Transactional
    public InventoryDepotDtos.CreateProformaResponse createProforma(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreateSaleRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryDepot depot = inventoryDepotRepository
                .findByIdAndHotel_Id(req.depotId(), hotelId)
                .orElseThrow(() -> notFound("Depot"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));

        PosProforma proforma = new PosProforma();
        proforma.setHotel(hotel);
        proforma.setDepot(depot);
        proforma.setProformaNumber(nextProformaNumber(hotelId));
        proforma.setCustomerName(req.customerName() == null ? null : req.customerName().trim());
        proforma.setCreatedBy(tenantAccessService.currentUser().getUsername());

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        List<InventoryDepotDtos.SaleLineRow> responseLines = new ArrayList<>();

        for (InventoryDepotDtos.SaleLineInput line : req.lines()) {
            if (line.quantity() == null || line.quantity().signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Quantity must be positive");
            }
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(line.productId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            if (!p.getDepot().getId().equals(depot.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Product does not belong to selected depot");
            }
            BigDecimal unitPrice = resolveLineUnitPrice(line, p);
            BigDecimal lineTotal = scale2(unitPrice.multiply(line.quantity()));
            total = total.add(lineTotal);

            PosProformaLine pl = new PosProformaLine();
            pl.setProforma(proforma);
            pl.setProduct(p);
            pl.setLineOrder(lineOrder++);
            pl.setQuantity(line.quantity().setScale(3, RoundingMode.HALF_UP));
            pl.setUnitPrice(unitPrice);
            pl.setLineTotal(lineTotal);
            pl.setTaxable(p.isTaxable());
            proforma.getLines().add(pl);

            responseLines.add(new InventoryDepotDtos.SaleLineRow(
                    p.getProductName(),
                    p.getProductCode(),
                    pl.getQuantity(),
                    pl.getUnitPrice(),
                    pl.getLineTotal(),
                    pl.isTaxable()));
        }

        proforma.setTotalAmount(scale2(total));
        applyPromotionToProforma(hotelId, proforma, scale2(total), req.promoCode());
        proforma = posProformaRepository.save(proforma);
        return new InventoryDepotDtos.CreateProformaResponse(
                proforma.getId(),
                proforma.getProformaNumber(),
                depot.getId(),
                proforma.getTotalAmount(),
                proforma.getCreatedAt(),
                responseLines,
                "Proforma created",
                proforma.getSubtotalAmount(),
                proforma.getDiscountAmount(),
                proforma.getPromoCode());
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.ProformaRow> listPosProformas(UUID hotelId, String hotelHeader, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return posProformaRepository.findByHotelId(hotelId, depotId).stream()
                .map(p -> new InventoryDepotDtos.ProformaRow(
                        p.getId(),
                        p.getProformaNumber(),
                        p.getDepot().getName(),
                        p.getCustomerName(),
                        p.getTotalAmount(),
                        p.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryDepotDtos.ProformaDetailResponse getPosProformaDetail(
            UUID hotelId, String hotelHeader, UUID proformaId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosProforma proforma = posProformaRepository
                .findFetchedByIdAndHotelId(proformaId, hotelId)
                .orElseThrow(() -> notFound("Proforma"));
        List<InventoryDepotDtos.SaleLineRow> lineRows = proforma.getLines().stream()
                .sorted(Comparator.comparing(PosProformaLine::getLineOrder))
                .map(pl -> new InventoryDepotDtos.SaleLineRow(
                        pl.getProduct().getProductName(),
                        pl.getProduct().getProductCode(),
                        pl.getQuantity(),
                        pl.getUnitPrice(),
                        pl.getLineTotal(),
                        pl.isTaxable()))
                .toList();
        return new InventoryDepotDtos.ProformaDetailResponse(
                proforma.getId(),
                proforma.getProformaNumber(),
                proforma.getDepot().getName(),
                proforma.getCustomerName(),
                proforma.getTotalAmount(),
                proforma.getCreatedAt(),
                lineRows);
    }

    @Transactional
    public InventoryDepotDtos.CreateSaleResponse convertProformaToSale(UUID hotelId, String hotelHeader, UUID proformaId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosProforma proforma = posProformaRepository
                .findFetchedByIdAndHotelId(proformaId, hotelId)
                .orElseThrow(() -> notFound("Proforma"));
        DepotSale sale = new DepotSale();
        sale.setHotel(proforma.getHotel());
        sale.setDepot(proforma.getDepot());
        sale.setSaleNumber(nextSaleNumber(hotelId));
        sale.setCustomerName(proforma.getCustomerName());
        sale.setPaymentMethod("CASH");
        sale.setCreatedBy(tenantAccessService.currentUser().getUsername());

        BigDecimal total = BigDecimal.ZERO;
        int lineOrder = 0;
        List<InventoryDepotDtos.SaleLineRow> responseLines = new ArrayList<>();
        for (PosProformaLine pl : proforma.getLines().stream()
                .sorted(Comparator.comparing(PosProformaLine::getLineOrder))
                .toList()) {
            DepotProduct p = depotProductRepository
                    .findByIdAndHotel_Id(pl.getProduct().getId(), hotelId)
                    .orElseThrow(() -> notFound("Product"));
            BigDecimal qty = pl.getQuantity();
            boolean managedStock = isManagedStockType(p.getStockType());
            if (managedStock && p.getStockQty().compareTo(qty) < 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock for " + p.getProductCode());
            }
            DepotSaleLine sl = new DepotSaleLine();
            sl.setSale(sale);
            sl.setProduct(p);
            sl.setLineOrder(lineOrder++);
            sl.setQuantity(qty.setScale(3, RoundingMode.HALF_UP));
            sl.setUnitPrice(scale2(pl.getUnitPrice()));
            sl.setLineTotal(scale2(pl.getLineTotal()));
            sl.setTaxable(pl.isTaxable());
            sale.getLines().add(sl);
            total = total.add(sl.getLineTotal());

            if (managedStock) {
                p.setStockQty(p.getStockQty().subtract(qty).setScale(3, RoundingMode.HALF_UP));
                depotProductRepository.save(p);
                if (p.getInventoryItem() != null) {
                    InventoryItem ii = inventoryItemRepository
                            .findByIdAndHotel_Id(p.getInventoryItem().getId(), hotelId)
                            .orElseThrow(() -> notFound("Inventory item"));
                    if (ii.getCurrentStock().compareTo(qty) < 0) {
                        throw new ApiException(HttpStatus.CONFLICT, "Insufficient ERP stock for linked item " + ii.getSku());
                    }
                    ii.setCurrentStock(ii.getCurrentStock().subtract(qty).setScale(4, RoundingMode.HALF_UP));
                    inventoryItemRepository.save(ii);
                    StockTransaction st = new StockTransaction();
                    st.setItem(ii);
                    st.setType(StockTransactionType.CONSUMPTION);
                    st.setQuantity(qty);
                    st.setReference("MENU_SALE:" + sale.getSaleNumber());
                    st.setNotes("Converted from proforma " + proforma.getProformaNumber());
                    st.setPerformedBy(tenantAccessService.currentUser().getUsername());
                    st.setFromLocation(proforma.getDepot().getName());
                    stockTransactionRepository.save(st);
                }
            }
            responseLines.add(new InventoryDepotDtos.SaleLineRow(
                    p.getProductName(), p.getProductCode(), sl.getQuantity(), sl.getUnitPrice(), sl.getLineTotal(), sl.isTaxable()));
        }
        sale.setTotalAmount(scale2(total));
        copyPromotionOntoSale(
                sale,
                proforma.getSubtotalAmount(),
                proforma.getDiscountAmount(),
                proforma.getPromoCode(),
                proforma.getPromotion());
        sale = depotSaleRepository.save(sale);
        posProformaRepository.delete(proforma);
        return new InventoryDepotDtos.CreateSaleResponse(
                sale.getId(),
                sale.getSaleNumber(),
                proforma.getDepot().getId(),
                sale.getTotalAmount(),
                sale.getCreatedAt(),
                responseLines,
                null,
                sale.getPaymentMethod(),
                "Proforma converted to invoice",
                sale.getSubtotalAmount(),
                sale.getDiscountAmount(),
                sale.getPromoCode(),
                sale.getPaymentCurrency(),
                sale.getExchangeRate(),
                sale.getForeignAmount());
    }

    private static String normalizePaymentMethod(String raw) {
        if (raw == null || raw.isBlank()) {
            return "CASH";
        }
        String normalized = raw.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "MOMO", "MOBILE MONEY", "MOBILE_MONEY" -> "MOMO";
            case "CREDIT CARD", "CREDIT_CARD", "CARD" -> "CREDIT CARD";
            case "BANK", "BANK TRANSFER", "BANK_TRANSFER" -> "BANK";
            case "CASH" -> "CASH";
            default -> normalized.length() > 32 ? normalized.substring(0, 32) : normalized;
        };
    }

    private static String normalizeMenuName(String raw) {
        if (raw == null || raw.isBlank()) return "GENERAL";
        return raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private static BigDecimal resolveLineUnitPrice(InventoryDepotDtos.SaleLineInput line, DepotProduct product) {
        if (line.unitPrice() != null && line.unitPrice().signum() > 0) {
            return scale2(line.unitPrice());
        }
        return scale2(product.getSellingPrice());
    }

    private static BigDecimal scale2(BigDecimal n) {
        return n == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : n.setScale(2, RoundingMode.HALF_UP);
    }

    private InventoryDepotDtos.DeliveryOrderRow toDeliveryOrderRow(PosDeliveryOrder order) {
        DepotSale sale = order.getSale();
        return new InventoryDepotDtos.DeliveryOrderRow(
                order.getId(),
                order.getDeliveryNumber(),
                order.getDepot().getName(),
                order.getCustomerName(),
                order.getLocationLabel(),
                order.getTotalAmount(),
                order.getStatus(),
                order.getCreatedAt(),
                sale != null ? sale.getId() : null,
                sale != null ? sale.getSaleNumber() : null);
    }

    private InventoryDepotDtos.DeliveryOrderDetailResponse toDeliveryOrderDetail(PosDeliveryOrder order) {
        DepotSale sale = order.getSale();
        List<InventoryDepotDtos.SaleLineRow> lineRows = order.getLines().stream()
                .sorted(Comparator.comparing(PosDeliveryOrderLine::getLineOrder))
                .map(dl -> new InventoryDepotDtos.SaleLineRow(
                        dl.getProduct().getProductName(),
                        dl.getProduct().getProductCode(),
                        dl.getQuantity(),
                        dl.getUnitPrice(),
                        dl.getLineTotal(),
                        dl.isTaxable()))
                .toList();
        return new InventoryDepotDtos.DeliveryOrderDetailResponse(
                order.getId(),
                order.getDeliveryNumber(),
                order.getDepot().getName(),
                order.getCustomerName(),
                order.getLocationLabel(),
                order.getTotalAmount(),
                order.getStatus(),
                order.getCreatedAt(),
                sale != null ? sale.getId() : null,
                sale != null ? sale.getSaleNumber() : null,
                lineRows,
                order.getSubtotalAmount() != null ? order.getSubtotalAmount() : order.getTotalAmount(),
                order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO,
                order.getPromoCode());
    }

    private void applyPromotionToSale(UUID hotelId, DepotSale sale, BigDecimal subtotal, String promoCode) {
        DynamicPricingService.AppliedPosPromo applied = dynamicPricingService.validatePosPromoCode(hotelId, promoCode, subtotal);
        sale.setSubtotalAmount(subtotal);
        sale.setDiscountAmount(applied.discountAmount());
        sale.setTotalAmount(scale2(subtotal.subtract(applied.discountAmount()).max(BigDecimal.ZERO)));
        if (applied.promotion() != null) {
            sale.setPromotion(applied.promotion());
            sale.setPromoCode(applied.promotion().getCode());
            dynamicPricingService.incrementUsage(hotelId, applied.promotion().getCode());
        } else {
            sale.setPromotion(null);
            sale.setPromoCode(null);
        }
    }

    private void applyPromotionToProforma(UUID hotelId, PosProforma proforma, BigDecimal subtotal, String promoCode) {
        DynamicPricingService.AppliedPosPromo applied = dynamicPricingService.validatePosPromoCode(hotelId, promoCode, subtotal);
        proforma.setSubtotalAmount(subtotal);
        proforma.setDiscountAmount(applied.discountAmount());
        proforma.setTotalAmount(scale2(subtotal.subtract(applied.discountAmount()).max(BigDecimal.ZERO)));
        if (applied.promotion() != null) {
            proforma.setPromotion(applied.promotion());
            proforma.setPromoCode(applied.promotion().getCode());
        } else {
            proforma.setPromotion(null);
            proforma.setPromoCode(null);
        }
    }

    private void applyPromotionToDelivery(UUID hotelId, PosDeliveryOrder order, BigDecimal subtotal, String promoCode) {
        DynamicPricingService.AppliedPosPromo applied = dynamicPricingService.validatePosPromoCode(hotelId, promoCode, subtotal);
        order.setSubtotalAmount(subtotal);
        order.setDiscountAmount(applied.discountAmount());
        order.setTotalAmount(scale2(subtotal.subtract(applied.discountAmount()).max(BigDecimal.ZERO)));
        if (applied.promotion() != null) {
            order.setPromotion(applied.promotion());
            order.setPromoCode(applied.promotion().getCode());
        } else {
            order.setPromotion(null);
            order.setPromoCode(null);
        }
    }

    private void copyPromotionOntoSale(
            DepotSale sale,
            BigDecimal subtotal,
            BigDecimal discount,
            String promoCode,
            Promotion promotion) {
        BigDecimal safeSubtotal = subtotal != null ? subtotal : sale.getTotalAmount();
        BigDecimal safeDiscount = discount != null ? discount : BigDecimal.ZERO;
        sale.setSubtotalAmount(safeSubtotal);
        sale.setDiscountAmount(safeDiscount);
        sale.setTotalAmount(scale2(safeSubtotal.subtract(safeDiscount).max(BigDecimal.ZERO)));
        sale.setPromoCode(promoCode);
        sale.setPromotion(promotion);
    }

    @Transactional(readOnly = true)
    public List<InventoryDepotDtos.PosPromotionRow> listPosPromotions(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return dynamicPricingService.listPosPromotions(hotelId).stream()
                .map(p -> new InventoryDepotDtos.PosPromotionRow(
                        p.getId(),
                        p.getCode(),
                        p.getName(),
                        p.getDiscountType(),
                        p.getDiscountValue(),
                        p.isActive(),
                        p.getUsageLimit(),
                        p.getUsageCount(),
                        p.getAppliesTo()))
                .toList();
    }

    @Transactional
    public InventoryDepotDtos.PosPromotionRow createPosPromotion(
            UUID hotelId, String hotelHeader, InventoryDepotDtos.CreatePosPromotionRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Promotion p = dynamicPricingService.createPosPromotion(
                hotelId, req.code(), req.name(), req.discountType(), req.discountValue(), req.usageLimit());
        return new InventoryDepotDtos.PosPromotionRow(
                p.getId(),
                p.getCode(),
                p.getName(),
                p.getDiscountType(),
                p.getDiscountValue(),
                p.isActive(),
                p.getUsageLimit(),
                p.getUsageCount(),
                p.getAppliesTo());
    }

    private InventoryDepotDtos.DepotRow toRow(InventoryDepot d) {
        InvWarehouse lw = d.getLinkedWarehouse();
        UUID whId = lw == null ? null : lw.getId();
        String whCode = lw == null ? null : lw.getCode();
        String whName = lw == null ? null : lw.getName();
        return new InventoryDepotDtos.DepotRow(
                d.getId(), d.getName(), d.getCode(), d.getDepotType().name(), d.isActive(), whId, whCode, whName);
    }

    private InventoryDepotDtos.DepotProductRow toProductRow(DepotProduct p) {
        InventoryItem inv = p.getInventoryItem();
        UUID invId = inv == null ? null : inv.getId();
        List<String> allergens = List.of();
        List<String> dietaryFlags = List.of();
        java.util.Map<String, String> nameTranslations = null;
        if (inv != null) {
            allergens = inv.getAllergens() != null ? inv.getAllergens() : List.of();
            dietaryFlags = inv.getDietaryFlags() != null ? inv.getDietaryFlags() : List.of();
            nameTranslations = inv.getNameTranslations();
        }
        String photoUrl = p.getPhotoUrl();
        if (photoUrl == null || photoUrl.isBlank()) {
            if (inv != null && inv.getImageUrl() != null && !inv.getImageUrl().isBlank()) {
                photoUrl = inv.getImageUrl().trim();
            } else {
                photoUrl = null;
            }
        } else {
            photoUrl = photoUrl.trim();
        }
        return new InventoryDepotDtos.DepotProductRow(
                p.getId(),
                p.getDepot().getId(),
                p.getDepot().getName(),
                p.getProductNumber(),
                p.getProductName(),
                p.getProductCode(),
                p.getBatchNo(),
                p.getExpiryDate(),
                p.getCostPrice(),
                p.getSellingPrice(),
                p.getStockQty(),
                canonicalStockTypeForApi(p.getStockType()),
                photoUrl,
                p.getMenuName(),
                p.isTaxable(),
                p.isActive(),
                invId,
                allergens,
                dietaryFlags,
                nameTranslations);
    }

    private String nextProductCode(UUID hotelId, String productName) {
        String prefix = prefixFromName(productName);
        List<DepotProduct> candidates = depotProductRepository.findByHotel_IdAndProductCodeStartingWithIgnoreCase(hotelId, prefix);
        int max = 0;
        for (DepotProduct p : candidates) {
            String code = p.getProductCode();
            if (code == null || code.length() <= prefix.length()) continue;
            String tail = code.substring(prefix.length());
            if (!tail.chars().allMatch(Character::isDigit)) continue;
            max = Math.max(max, Integer.parseInt(tail));
        }
        return prefix + String.format("%03d", max + 1);
    }

    private static String prefixFromName(String name) {
        String cleaned = name == null ? "" : name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (cleaned.isBlank()) return "PRD";
        if (cleaned.length() >= 3) return cleaned.substring(0, 3);
        return (cleaned + "XXX").substring(0, 3);
    }

    private static String normalizeCode(String raw) {
        String c = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "");
        if (c.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid code");
        return c;
    }

    private static String parseStockType(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        return canonicalStockType(raw);
    }

    /** Normalizes UI/API variants (e.g. "NON STOCK", "non-stock") to STOCK / NON_STOCK. */
    private static String canonicalStockType(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        throw new ApiException(HttpStatus.BAD_REQUEST, "stockType must be STOCK or NON_STOCK");
    }

    /** Read path: never throws; unknown values default to STOCK for stable API output. */
    private static String canonicalStockTypeForApi(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        return "STOCK";
    }

    private static boolean isManagedStockType(String raw) {
        return "STOCK".equals(canonicalStockTypeOrDefaultStock(raw));
    }

    /**
     * For sale checks: unknown/blank values are treated as non-managed so legacy rows are not
     * blocked if the column was missing or inconsistent; only explicit STOCK is quantity-managed.
     */
    private static String canonicalStockTypeOrDefaultStock(String raw) {
        if (raw == null || raw.isBlank()) return "NON_STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        return "NON_STOCK";
    }

    private static DepotType parseDepotType(String raw) {
        if (raw == null || raw.isBlank()) return DepotType.OTHER;
        String value = raw.trim().toUpperCase(Locale.ROOT);
        if ("PATISRY".equals(value) || "PASTRY".equals(value)) return DepotType.PATISSERIE;
        return DepotType.valueOf(value);
    }

    private String nextRefundNumber(UUID hotelId) {
        long next = depotSaleRefundRepository.countByHotelId(hotelId) + 1;
        return "DR-" + Year.now().getValue() + "-" + String.format("%06d", next);
    }

    private String nextSaleNumber(UUID hotelId) {
        long next = depotSaleRepository.countByHotelId(hotelId) + 1;
        return "DS-" + Year.now().getValue() + "-" + String.format("%06d", next);
    }

    private String nextProformaNumber(UUID hotelId) {
        long next = posProformaRepository.countByHotelId(hotelId) + 1;
        return "PF-" + Year.now().getValue() + "-" + String.format("%06d", next);
    }

    private String nextDeliveryNumber(UUID hotelId) {
        long next = posDeliveryOrderRepository.countByHotelId(hotelId) + 1;
        return "DEL-" + Year.now().getValue() + "-" + String.format("%06d", next);
    }

    private void applyForeignCurrencyPayment(DepotSale sale, InventoryDepotDtos.CreateSaleRequest req) {
        if (Boolean.TRUE.equals(req.chargeToRoom())) {
            sale.setPaymentCurrency(null);
            sale.setExchangeRate(null);
            sale.setForeignAmount(null);
            return;
        }
        String currency = req.paymentCurrency() == null ? null : req.paymentCurrency().trim().toUpperCase(Locale.ROOT);
        if (currency == null || currency.isBlank()) {
            sale.setPaymentCurrency(null);
            sale.setExchangeRate(null);
            sale.setForeignAmount(null);
            return;
        }
        if (!currency.matches("[A-Z]{3}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "paymentCurrency must be a 3-letter code (e.g. USD, EUR).");
        }
        String hotelCurrency = sale.getHotel() != null && sale.getHotel().getCurrency() != null
                ? sale.getHotel().getCurrency().trim().toUpperCase(Locale.ROOT)
                : "";
        if (!hotelCurrency.isBlank() && currency.equals(hotelCurrency)) {
            sale.setPaymentCurrency(null);
            sale.setExchangeRate(null);
            sale.setForeignAmount(null);
            return;
        }
        BigDecimal rate = req.exchangeRate();
        if (rate == null || rate.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "exchangeRate is required when paying in " + currency);
        }
        BigDecimal foreign = req.foreignAmount();
        if (foreign == null || foreign.signum() <= 0) {
            // Derive from sale total when client omitted it.
            foreign = sale.getTotalAmount().divide(rate, 2, RoundingMode.HALF_UP);
        }
        sale.setPaymentCurrency(currency);
        sale.setExchangeRate(rate.setScale(6, RoundingMode.HALF_UP));
        sale.setForeignAmount(scale2(foreign));
    }

    private void applyMobileSaleFields(DepotSale sale, InventoryDepotDtos.CreateSaleRequest req, UUID hotelId) {
        if (req.tableLabel() != null && !req.tableLabel().isBlank()) {
            sale.setTableLabel(req.tableLabel().trim());
        }
        if (Boolean.TRUE.equals(req.chargeToRoom())) {
            sale.setPaymentMethod("ROOM");
        } else if (req.paymentMethod() != null && !req.paymentMethod().isBlank()) {
            sale.setPaymentMethod(req.paymentMethod().trim().toUpperCase(Locale.ROOT));
        }
        resolveStaffUser(req.staffId(), hotelId).ifPresent(sale::setStaffUser);
    }

    private Optional<AppUser> resolveStaffUser(UUID staffId, UUID hotelId) {
        UUID id = staffId != null ? staffId : tenantAccessService.currentUser().getId();
        return appUserRepository
                .findByIdWithHotel(id)
                .filter(u -> u.getHotel() != null && hotelId.equals(u.getHotel().getId()));
    }

    private static boolean isMobilePosActivity(String tableOrLocation, AppUser staffUser) {
        return staffUser != null || (tableOrLocation != null && !tableOrLocation.isBlank());
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }

    private record DepotSeed(String name, String code, DepotType type) {}
}
