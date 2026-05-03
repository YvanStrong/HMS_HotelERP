package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.InventoryDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.InventoryItemType;
import com.hms.domain.PoPaymentTerms;
import com.hms.domain.PurchaseOrderStatus;
import com.hms.domain.ReservationStatus;
import com.hms.domain.StockTransactionType;
import com.hms.entity.Hotel;
import com.hms.entity.InventoryCategory;
import com.hms.entity.InventoryItem;
import com.hms.entity.PurchaseOrder;
import com.hms.entity.PurchaseOrderLine;
import com.hms.entity.StockTransaction;
import com.hms.entity.Supplier;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryCategoryRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.repository.PurchaseOrderLineRepository;
import com.hms.repository.PurchaseOrderRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.StockTransactionRepository;
import com.hms.repository.SupplierRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {

    private final InventoryItemRepository inventoryItemRepository;
    private final InventoryCategoryRepository inventoryCategoryRepository;
    private final HotelRepository hotelRepository;
    private final SupplierRepository supplierRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderLineRepository purchaseOrderLineRepository;
    private final StockTransactionRepository stockTransactionRepository;
    private final ReservationRepository reservationRepository;
    private final TenantAccessService tenantAccessService;
    private final ChargeService chargeService;
    private final ObjectMapper objectMapper;

    public InventoryService(
            InventoryItemRepository inventoryItemRepository,
            InventoryCategoryRepository inventoryCategoryRepository,
            HotelRepository hotelRepository,
            SupplierRepository supplierRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            PurchaseOrderLineRepository purchaseOrderLineRepository,
            StockTransactionRepository stockTransactionRepository,
            ReservationRepository reservationRepository,
            TenantAccessService tenantAccessService,
            ChargeService chargeService,
            ObjectMapper objectMapper) {
        this.inventoryItemRepository = inventoryItemRepository;
        this.inventoryCategoryRepository = inventoryCategoryRepository;
        this.hotelRepository = hotelRepository;
        this.supplierRepository = supplierRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.purchaseOrderLineRepository = purchaseOrderLineRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.reservationRepository = reservationRepository;
        this.tenantAccessService = tenantAccessService;
        this.chargeService = chargeService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public InventoryDtos.InventoryItemsResponse listItems(
            UUID hotelId,
            String hotelHeader,
            String category,
            Boolean lowStock,
            String search) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String cat = category != null && !category.isBlank() ? category.trim() : null;
        String s = search != null && !search.isBlank() ? search.trim() : null;
        UUID categoryId = null;
        if (cat != null) {
            categoryId = inventoryCategoryRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                    .filter(c -> c.getCode() != null && c.getCode().equalsIgnoreCase(cat))
                    .findFirst()
                    .map(InventoryCategory::getId)
                    .orElse(null);
            if (categoryId == null) {
                long totalItems = inventoryItemRepository.countByHotel_Id(hotelId);
                long low = inventoryItemRepository.countLowStock(hotelId);
                long out = inventoryItemRepository.countOutOfStock(hotelId);
                BigDecimal totalValue = inventoryItemRepository.sumStockValue(hotelId);
                return new InventoryDtos.InventoryItemsResponse(
                        List.of(),
                        new InventoryDtos.InventoryListSummary(totalItems, low, out, totalValue));
            }
        }
        List<InventoryItem> raw = inventoryItemRepository.search(hotelId, categoryId, s);
        List<InventoryItem> filtered = new ArrayList<>();
        for (InventoryItem i : raw) {
            if (s != null) {
                String needle = s.toLowerCase();
                String name = i.getName() != null ? i.getName().toLowerCase() : "";
                String sku = i.getSku() != null ? i.getSku().toLowerCase() : "";
                if (!name.contains(needle) && !sku.contains(needle)) {
                    continue;
                }
            }
            if (Boolean.TRUE.equals(lowStock) && i.getReorderPoint() != null) {
                if (i.getCurrentStock().compareTo(i.getReorderPoint()) >= 0) {
                    continue;
                }
            }
            filtered.add(i);
        }
        List<InventoryDtos.InventoryItemRow> rows = filtered.stream().map(this::toRow).toList();
        long totalItems = inventoryItemRepository.countByHotel_Id(hotelId);
        long low = inventoryItemRepository.countLowStock(hotelId);
        long out = inventoryItemRepository.countOutOfStock(hotelId);
        BigDecimal totalValue = inventoryItemRepository.sumStockValue(hotelId);
        return new InventoryDtos.InventoryItemsResponse(
                rows, new InventoryDtos.InventoryListSummary(totalItems, low, out, totalValue));
    }

    private InventoryDtos.InventoryItemRow toRow(InventoryItem i) {
        String status = stockStatus(i);
        Instant last = stockTransactionRepository
                .findLastReceiptTime(i.getId(), StockTransactionType.RECEIPT)
                .orElse(null);
        InventoryDtos.SupplierSummary sup = i.getPreferredSupplier() != null
                ? new InventoryDtos.SupplierSummary(
                        i.getPreferredSupplier().getId(), i.getPreferredSupplier().getName())
                : null;
        return new InventoryDtos.InventoryItemRow(
                i.getId(),
                i.getName(),
                i.getSku(),
                i.getCategory().getCode(),
                i.getCurrentStock(),
                i.getMinimumStock(),
                i.getReorderPoint(),
                i.getUnitOfMeasure(),
                i.getUnitCost(),
                i.isMinibarItem(),
                i.getMinibarReorderThreshold(),
                status,
                last,
                sup);
    }

    private static String stockStatus(InventoryItem i) {
        if (i.getCurrentStock().compareTo(BigDecimal.ZERO) <= 0) {
            return "OUT_OF_STOCK";
        }
        if (i.getReorderPoint() != null && i.getCurrentStock().compareTo(i.getReorderPoint()) < 0) {
            return "LOW_STOCK";
        }
        return "ADEQUATE";
    }

    @Transactional
    public InventoryDtos.ConsumeResponse consume(
            UUID hotelId, String hotelHeader, UUID itemId, InventoryDtos.ConsumeRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem item =
                inventoryItemRepository.findByIdAndHotel_Id(itemId, hotelId).orElseThrow(() -> notFound("Item"));
        BigDecimal qty = req.quantity();
        if (qty == null || qty.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "quantity must be positive");
        }
        StockTransactionType txType = StockTransactionType.CONSUMPTION;
        if (req.type() != null && !req.type().isBlank()) {
            txType = StockTransactionType.valueOf(req.type().trim().toUpperCase());
        }
        if (item.getCurrentStock().subtract(qty).signum() < 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Insufficient stock");
        }
        BigDecimal prev = item.getCurrentStock();
        item.setCurrentStock(prev.subtract(qty));
        inventoryItemRepository.save(item);

        StockTransaction st = new StockTransaction();
        st.setItem(item);
        st.setType(txType);
        st.setQuantity(qty.negate());
        st.setReference(refString(req.reference()));
        st.setPerformedBy(req.performedBy() != null ? req.performedBy() : tenantAccessService.currentUser().getUsername());
        st.setNotes(req.notes());
        if (req.location() != null) {
            st.setFromLocation(req.location().from());
            st.setToLocation(req.location().to());
        }
        st = stockTransactionRepository.save(st);

        List<InventoryDtos.ConsumeAlert> alerts = new ArrayList<>();
        List<InventoryDtos.ConsumeEvent> events = new ArrayList<>();
        events.add(new InventoryDtos.ConsumeEvent(
                "inventory.consumed", item.getId().toString(), qty, null));

        InventoryDtos.ConsumeRoomChargeSummary roomSummary = null;
        if (req.reference() != null
                && "ROOM_CHARGE".equalsIgnoreCase(req.reference().type())
                && req.reference().id() != null) {
            UUID resId = UUID.fromString(req.reference().id().trim());
            var res = reservationRepository
                    .findByIdAndHotel_Id(resId, hotelId)
                    .orElseThrow(() -> notFound("Reservation"));
            if (res.getStatus() != ReservationStatus.CHECKED_IN) {
                throw new ApiException(HttpStatus.CONFLICT, "Reservation must be CHECKED_IN to post room charge");
            }
            BigDecimal amount = item.getUnitCost() != null
                    ? item.getUnitCost().multiply(qty).setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            String meta = metaJson(item.getId(), qty, item.getSku());
            var charge = chargeService.postFolioCharge(
                    hotelId,
                    res,
                    amount,
                    item.getName() + " x" + qty.stripTrailingZeros().toPlainString(),
                    item.isMinibarItem() ? ChargeType.MINIBAR : ChargeType.OTHER,
                    st.getPerformedBy(),
                    meta,
                    item.getSku());
            roomSummary = new InventoryDtos.ConsumeRoomChargeSummary(charge.getId(), charge.getAmount(), true);
            events.add(new InventoryDtos.ConsumeEvent(
                    "room.charge.created", item.getId().toString(), qty, charge.getId().toString()));
        }

        if (Boolean.TRUE.equals(req.autoReorderCheck())
                && item.getReorderPoint() != null
                && item.getCurrentStock().compareTo(item.getReorderPoint()) < 0) {
            BigDecimal suggested =
                    item.getMaximumStock() != null
                            ? item.getMaximumStock().subtract(item.getCurrentStock())
                            : item.getReorderPoint().multiply(BigDecimal.valueOf(2));
            String supName =
                    item.getPreferredSupplier() != null ? item.getPreferredSupplier().getName() : "—";
            alerts.add(new InventoryDtos.ConsumeAlert(
                    "REORDER_ALERT",
                    item.getName() + " below reorder point (" + item.getCurrentStock() + " < " + item.getReorderPoint() + ")",
                    suggested.max(BigDecimal.ZERO),
                    supName));
        }

        return new InventoryDtos.ConsumeResponse(
                st.getId(),
                toRow(inventoryItemRepository.findById(item.getId()).orElseThrow()),
                roomSummary,
                alerts,
                events);
    }

    private String metaJson(UUID itemId, BigDecimal qty, String productSku) {
        try {
            java.util.Map<String, String> m = new java.util.LinkedHashMap<>();
            m.put("inventoryItemId", itemId.toString());
            m.put("quantity", qty.stripTrailingZeros().toPlainString());
            if (productSku != null && !productSku.isBlank()) {
                m.put("productSku", productSku.trim());
            }
            return objectMapper.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private static String refString(InventoryDtos.ConsumeReference ref) {
        if (ref == null) {
            return null;
        }
        return ref.type() + ":" + ref.id();
    }

    @Transactional
    public InventoryDtos.CreatePurchaseOrderResponse createPurchaseOrder(
            UUID hotelId, String hotelHeader, InventoryDtos.CreatePurchaseOrderRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Supplier supplier = supplierRepository
                .findByIdAndHotel_Id(req.supplierId(), hotelId)
                .orElseThrow(() -> notFound("Supplier"));
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        PurchaseOrder po = new PurchaseOrder();
        po.setHotel(hotel);
        po.setSupplier(supplier);
        po.setPoNumber(nextPoNumber(hotelId));
        po.setExpectedDelivery(req.expectedDelivery());
        po.setPaymentTerms(parseTerms(req.paymentTerms()));
        po.setDeliveryInstructions(req.deliveryInstructions());
        po.setStatus(PurchaseOrderStatus.DRAFT);
        if (req.approvalWorkflow() != null) {
            po.setRequiresApproval(Boolean.TRUE.equals(req.approvalWorkflow().requiresApproval()));
        }
        BigDecimal total = BigDecimal.ZERO;
        int ord = 0;
        List<InventoryDtos.PoLineResponse> lineDtos = new ArrayList<>();
        for (InventoryDtos.PoLineInput line : req.lines()) {
            InventoryItem item = inventoryItemRepository
                    .findByIdAndHotel_Id(line.itemId(), hotelId)
                    .orElseThrow(() -> notFound("Inventory item"));
            PurchaseOrderLine pl = new PurchaseOrderLine();
            pl.setPurchaseOrder(po);
            pl.setItem(item);
            pl.setLineOrder(ord++);
            pl.setQuantityOrdered(line.quantity());
            pl.setUnitPrice(line.unitPrice());
            pl.setNotes(line.notes());
            BigDecimal lineTotal = line.quantity().multiply(line.unitPrice()).setScale(2, RoundingMode.HALF_UP);
            total = total.add(lineTotal);
            po.getLines().add(pl);
            lineDtos.add(new InventoryDtos.PoLineResponse(
                    null, item.getName(), item.getSku(), line.quantity(), line.unitPrice(), lineTotal));
        }
        po.setTotalAmount(total.setScale(2, RoundingMode.HALF_UP));
        po = purchaseOrderRepository.save(po);
        List<InventoryDtos.PoLineResponse> withIds = new ArrayList<>();
        for (int i = 0; i < po.getLines().size(); i++) {
            PurchaseOrderLine pl = po.getLines().get(i);
            InventoryDtos.PoLineResponse old = lineDtos.get(i);
            withIds.add(new InventoryDtos.PoLineResponse(
                    pl.getId(), old.itemName(), old.sku(), old.quantity(), old.unitPrice(), old.lineTotal()));
        }
        String approvalUrl = "/api/v1/hotels/" + hotelId + "/inventory/purchase-orders/" + po.getId() + "/approve";
        return new InventoryDtos.CreatePurchaseOrderResponse(
                po.getId(),
                po.getPoNumber(),
                po.getStatus().name(),
                po.getTotalAmount(),
                withIds,
                List.of(
                        "PO created in DRAFT status",
                        "Submit for approval or edit before receiving goods"),
                approvalUrl);
    }

    private PoPaymentTerms parseTerms(String raw) {
        if (raw == null || raw.isBlank()) {
            return PoPaymentTerms.NET_30;
        }
        return PoPaymentTerms.valueOf(raw.trim().toUpperCase());
    }

    private String nextPoNumber(UUID hotelId) {
        long n = purchaseOrderRepository.countByHotel_Id(hotelId) + 1;
        return "PO-" + Year.now() + "-" + String.format("%05d", n);
    }

    @Transactional
    public InventoryDtos.ReceiveGoodsResponse receiveGoods(
            UUID hotelId, String hotelHeader, UUID pathItemId, InventoryDtos.ReceiveGoodsRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PurchaseOrder po = purchaseOrderRepository
                .findByIdAndHotel_Id(req.purchaseOrderId(), hotelId)
                .orElseThrow(() -> notFound("Purchase order"));
        if (po.getStatus() == PurchaseOrderStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "Cannot receive against a cancelled PO");
        }
        List<InventoryDtos.ReceiveStockUpdate> stockUpdates = new ArrayList<>();
        List<InventoryDtos.ReceiveDiscrepancy> discrepancies = new ArrayList<>();
        List<InventoryDtos.ReceiveAlert> alerts = new ArrayList<>();

        for (InventoryDtos.ReceiveLineInput rl : req.receivedLines()) {
            PurchaseOrderLine pl = purchaseOrderLineRepository
                    .findByIdAndPurchaseOrder_Hotel_Id(rl.poLineId(), hotelId)
                    .orElseThrow(() -> notFound("PO line"));
            if (!pl.getPurchaseOrder().getId().equals(po.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "PO line does not belong to this purchase order");
            }
            InventoryItem item = pl.getItem();
            if (!item.getId().equals(pathItemId)) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST, "Each received PO line must match the path itemId (" + pathItemId + ")");
            }
            BigDecimal prev = item.getCurrentStock();
            BigDecimal ordered = pl.getQuantityOrdered();
            BigDecimal already = pl.getQuantityReceived();
            BigDecimal recv = rl.quantityReceived();
            BigDecimal expectedRemaining = ordered.subtract(already);
            if (recv.compareTo(expectedRemaining) < 0) {
                discrepancies.add(new InventoryDtos.ReceiveDiscrepancy(
                        "SHORTAGE",
                        item.getId(),
                        expectedRemaining,
                        recv,
                        "Record shortage; supplier credit may be pending"));
            }
            pl.setQuantityReceived(already.add(recv));
            purchaseOrderLineRepository.save(pl);

            StockTransaction st = new StockTransaction();
            st.setItem(item);
            st.setType(StockTransactionType.RECEIPT);
            st.setQuantity(recv);
            st.setReference("PO:" + po.getId());
            st.setPerformedBy(req.receivedBy() != null ? req.receivedBy() : tenantAccessService.currentUser().getUsername());
            st.setNotes(rl.notes());
            st.setToLocation(req.location());
            stockTransactionRepository.save(st);

            item.setCurrentStock(prev.add(recv));
            inventoryItemRepository.save(item);
            stockUpdates.add(new InventoryDtos.ReceiveStockUpdate(
                    item.getId(),
                    prev,
                    recv,
                    item.getCurrentStock(),
                    stockStatus(item)));
            alerts.add(new InventoryDtos.ReceiveAlert(
                    "STOCK_LEVEL_UPDATED", item.getName() + " stock updated after receipt"));
        }

        purchaseOrderRepository.flush();
        PurchaseOrder fresh = purchaseOrderRepository.findById(po.getId()).orElseThrow();
        boolean allComplete = true;
        BigDecimal remaining = BigDecimal.ZERO;
        for (PurchaseOrderLine pl : fresh.getLines()) {
            if (pl.getQuantityReceived().compareTo(pl.getQuantityOrdered()) < 0) {
                allComplete = false;
                remaining = remaining.add(pl.getQuantityOrdered().subtract(pl.getQuantityReceived()));
            }
        }
        fresh.setStatus(allComplete ? PurchaseOrderStatus.COMPLETED : PurchaseOrderStatus.PARTIAL_RECEIVED);
        fresh.setReceivedDate(Instant.now());
        purchaseOrderRepository.save(fresh);

        return new InventoryDtos.ReceiveGoodsResponse(
                UUID.randomUUID(),
                new InventoryDtos.ReceivePoSummary(fresh.getPoNumber(), fresh.getStatus().name(), remaining),
                stockUpdates,
                discrepancies,
                alerts);
    }

    @Transactional
    public InventoryDtos.CreatedIdResponse createSupplier(
            UUID hotelId, String hotelHeader, InventoryDtos.SupplierCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (!hotelRepository.existsById(hotelId)) {
            throw notFound("Hotel");
        }
        Supplier s = new Supplier();
        s.setHotel(hotelRepository.getReferenceById(hotelId));
        s.setName(req.name().trim());
        s.setContactPerson(req.contactPerson());
        s.setEmail(req.email());
        s.setPhone(req.phone());
        s = supplierRepository.save(s);
        return new InventoryDtos.CreatedIdResponse(s.getId());
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.SupplierSummary> listSuppliers(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return supplierRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(s -> new InventoryDtos.SupplierSummary(s.getId(), s.getName()))
                .toList();
    }

    @Transactional
    public InventoryDtos.CreatedIdResponse createCategory(
            UUID hotelId, String hotelHeader, InventoryDtos.CategoryCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String code = req.code().trim();
        if (inventoryCategoryRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Category code already exists: " + code);
        }
        InventoryCategory c = new InventoryCategory();
        c.setHotel(hotelRepository.getReferenceById(hotelId));
        c.setName(req.name().trim());
        c.setCode(code.toUpperCase());
        c = inventoryCategoryRepository.save(c);
        return new InventoryDtos.CreatedIdResponse(c.getId());
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.CategorySummary> listCategories(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return inventoryCategoryRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(c -> new InventoryDtos.CategorySummary(c.getId(), c.getName(), c.getCode()))
                .toList();
    }

    @Transactional
    public InventoryDtos.CreatedIdResponse createItem(
            UUID hotelId, String hotelHeader, InventoryDtos.InventoryItemCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryCategory cat = inventoryCategoryRepository
                .findByIdAndHotel_Id(req.categoryId(), hotelId)
                .orElseThrow(() -> notFound("Category"));
        String sku = req.sku().trim();
        if (inventoryItemRepository.findByHotel_IdAndSkuIgnoreCase(hotelId, sku).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "SKU already exists for this hotel: " + sku);
        }
        InventoryItem i = new InventoryItem();
        i.setHotel(hotelRepository.getReferenceById(hotelId));
        i.setCategory(cat);
        i.setName(req.name().trim());
        i.setSku(sku);
        i.setCurrentStock(req.currentStock() != null ? req.currentStock() : BigDecimal.ZERO);
        i.setReorderPoint(req.reorderPoint() != null ? req.reorderPoint() : BigDecimal.ZERO);
        i.setUnitCost(req.unitCost() != null ? req.unitCost() : BigDecimal.ZERO);
        i.setMinibarItem(Boolean.TRUE.equals(req.isMinibarItem()));
        i.setMinibarReorderThreshold(req.minibarReorderThreshold());
        i.setUnitOfMeasure(req.unitOfMeasure() != null && !req.unitOfMeasure().isBlank() ? req.unitOfMeasure().trim() : "piece");
        i.setType(i.isMinibarItem() ? InventoryItemType.MINIBAR_PRODUCT : InventoryItemType.CONSUMABLE);
        i.setPreferredSupplier(null);
        i = inventoryItemRepository.save(i);
        return new InventoryDtos.CreatedIdResponse(i.getId());
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
