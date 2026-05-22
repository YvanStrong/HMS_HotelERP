package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.InventoryDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.InventoryItemType;
import com.hms.domain.PoPaymentTerms;
import com.hms.domain.ValuationMethod;
import com.hms.domain.PurchaseOrderStatus;
import com.hms.domain.ReservationStatus;
import com.hms.domain.StockTransactionType;
import com.hms.entity.Hotel;
import com.hms.entity.InventoryCategory;
import com.hms.entity.InventoryItem;
import com.hms.entity.PurchaseOrder;
import com.hms.entity.InvWarehouse;
import com.hms.entity.PurchaseOrderLine;
import com.hms.entity.StockTransaction;
import com.hms.entity.Supplier;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryCategoryRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.repository.InvWarehouseRepository;
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
import java.util.Locale;
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
    private final InvWarehouseRepository invWarehouseRepository;
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
            InvWarehouseRepository invWarehouseRepository,
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
        this.invWarehouseRepository = invWarehouseRepository;
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
                long totalItems = inventoryItemRepository.countByHotel_IdAndActiveTrue(hotelId);
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
        long totalItems = inventoryItemRepository.countByHotel_IdAndActiveTrue(hotelId);
        long low = inventoryItemRepository.countLowStock(hotelId);
        long out = inventoryItemRepository.countOutOfStock(hotelId);
        BigDecimal totalValue = inventoryItemRepository.sumStockValue(hotelId);
        return new InventoryDtos.InventoryItemsResponse(
                rows, new InventoryDtos.InventoryListSummary(totalItems, low, out, totalValue));
    }

    @Transactional(readOnly = true)
    public InventoryDtos.InventoryItemRow getItem(UUID hotelId, String hotelHeader, UUID itemId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem i =
                inventoryItemRepository.findByIdAndHotel_Id(itemId, hotelId).orElseThrow(() -> notFound("Item"));
        return toRow(i);
    }

    /** Resolve a product by barcode (preferred) or SKU for POS / receiving scans. */
    @Transactional(readOnly = true)
    public InventoryDtos.InventoryItemRow lookupProduct(UUID hotelId, String hotelHeader, String sku, String barcode) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem i = null;
        if (barcode != null && !barcode.isBlank()) {
            i = inventoryItemRepository
                    .findByHotel_IdAndBarcodeIgnoreCase(hotelId, barcode.trim())
                    .orElse(null);
        }
        if (i == null && sku != null && !sku.isBlank()) {
            i = inventoryItemRepository
                    .findByHotel_IdAndSkuIgnoreCase(hotelId, sku.trim())
                    .orElse(null);
        }
        if (i == null) {
            throw notFound("Product");
        }
        if (!i.isActive()) {
            throw new ApiException(HttpStatus.GONE, "Product is inactive");
        }
        return toRow(i);
    }

    @Transactional
    public InventoryDtos.InventoryItemRow patchItem(
            UUID hotelId, String hotelHeader, UUID itemId, InventoryDtos.InventoryItemPatchRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem i =
                inventoryItemRepository.findByIdAndHotel_Id(itemId, hotelId).orElseThrow(() -> notFound("Item"));
        if (req.name() != null && !req.name().isBlank()) {
            i.setName(req.name().trim());
        }
        if (req.sku() != null && !req.sku().isBlank()) {
            String newSku = req.sku().trim();
            final UUID currentItemId = i.getId();
            inventoryItemRepository
                    .findByHotel_IdAndSkuIgnoreCase(hotelId, newSku)
                    .filter(other -> !other.getId().equals(currentItemId))
                    .ifPresent(x -> {
                        throw new ApiException(HttpStatus.CONFLICT, "SKU already exists: " + newSku);
                    });
            i.setSku(newSku);
        }
        if (req.categoryId() != null) {
            InventoryCategory cat = inventoryCategoryRepository
                    .findByIdAndHotel_Id(req.categoryId(), hotelId)
                    .orElseThrow(() -> notFound("Category"));
            i.setCategory(cat);
        }
        if (req.stockType() != null && !req.stockType().isBlank()) {
            String stockType = normalizeStockType(req.stockType());
            i.setStockType(stockType);
            if ("NON_STOCK".equals(stockType)) {
                i.setCurrentStock(BigDecimal.ZERO);
                i.setReorderPoint(BigDecimal.ZERO);
                i.setMinimumStock(BigDecimal.ZERO);
                i.setMaximumStock(null);
            }
        }
        if (req.reorderPoint() != null) {
            i.setReorderPoint("NON_STOCK".equals(normalizeStockType(i.getStockType())) ? BigDecimal.ZERO : req.reorderPoint());
        }
        if (req.minimumStock() != null) {
            i.setMinimumStock("NON_STOCK".equals(normalizeStockType(i.getStockType())) ? BigDecimal.ZERO : req.minimumStock());
        }
        if (req.maximumStock() != null) {
            i.setMaximumStock("NON_STOCK".equals(normalizeStockType(i.getStockType())) ? null : req.maximumStock());
        }
        if (req.unitCost() != null) {
            i.setUnitCost(req.unitCost());
        }
        if (req.sellingPrice() != null) {
            i.setSellingPrice(req.sellingPrice());
        }
        if (req.unitOfMeasure() != null && !req.unitOfMeasure().isBlank()) {
            i.setUnitOfMeasure(req.unitOfMeasure().trim());
        }
        if (req.description() != null) {
            i.setDescription(req.description().isBlank() ? null : req.description().trim());
        }
        if (req.barcode() != null) {
            i.setBarcode(req.barcode().isBlank() ? null : req.barcode().trim());
        }
        if (req.imageUrl() != null) {
            i.setImageUrl(req.imageUrl().isBlank() ? null : req.imageUrl().trim());
        }
        if (req.expiryDate() != null) {
            i.setExpiryDate(req.expiryDate());
        }
        if (req.manufactureDate() != null) {
            i.setManufactureDate(req.manufactureDate());
        }
        if (req.active() != null) {
            i.setActive(req.active());
        }
        if (req.valuationMethod() != null && !req.valuationMethod().isBlank()) {
            i.setValuation(ValuationMethod.valueOf(req.valuationMethod().trim().toUpperCase()));
        }
        i = inventoryItemRepository.save(i);
        return toRow(i);
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
        String val = i.getValuation() != null ? i.getValuation().name() : ValuationMethod.AVERAGE_COST.name();
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
                sup,
                i.getDescription(),
                i.getBarcode(),
                i.getSellingPrice(),
                i.isActive(),
                i.getExpiryDate(),
                i.getManufactureDate(),
                val,
                i.getImageUrl(),
                normalizeStockType(i.getStockType()));
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
            String recvNotes = rl.notes();
            if (rl.batchNumber() != null && !rl.batchNumber().isBlank()) {
                recvNotes = (recvNotes != null ? recvNotes + " " : "") + "[batch=" + rl.batchNumber().trim() + "]";
            }
            if (rl.expiryDate() != null && !rl.expiryDate().isBlank()) {
                recvNotes = (recvNotes != null ? recvNotes + " " : "") + "[expiry=" + rl.expiryDate().trim() + "]";
            }
            st.setNotes(recvNotes);
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
        String name = req.name().trim();
        String code =
                req.code() != null && !req.code().isBlank()
                        ? req.code().trim().toUpperCase(Locale.ROOT)
                        : generateUniqueCategoryCode(hotelId, name);
        if (inventoryCategoryRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Category code already exists: " + code);
        }
        InventoryCategory c = new InventoryCategory();
        c.setHotel(hotelRepository.getReferenceById(hotelId));
        c.setName(name);
        c.setCode(code);
        c = inventoryCategoryRepository.save(c);
        return new InventoryDtos.CreatedIdResponse(c.getId());
    }

    private String generateUniqueCategoryCode(UUID hotelId, String name) {
        String base = name.replaceAll("[^A-Za-z0-9]+", "").toUpperCase(Locale.ROOT);
        if (base.length() > 50) {
            base = base.substring(0, 50);
        }
        if (base.isEmpty()) {
            base = "CAT";
        }
        String candidate = base.length() > 64 ? base.substring(0, 64) : base;
        int n = 0;
        while (inventoryCategoryRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, candidate)) {
            n++;
            String suffix = "-" + n;
            int keep = Math.max(1, 64 - suffix.length());
            candidate = (base.length() > keep ? base.substring(0, keep) : base) + suffix;
        }
        return candidate;
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
        String sku =
                req.sku() != null && !req.sku().isBlank()
                        ? req.sku().trim().toUpperCase(Locale.ROOT)
                        : generateUniqueSku(hotelId);
        if (inventoryItemRepository.findByHotel_IdAndSkuIgnoreCase(hotelId, sku).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "SKU already exists for this hotel: " + sku);
        }
        InventoryItem i = new InventoryItem();
        i.setHotel(hotelRepository.getReferenceById(hotelId));
        i.setCategory(cat);
        i.setName(req.name().trim());
        i.setSku(sku);
        String stockType = normalizeStockType(req.stockType());
        i.setStockType(stockType);
        if ("NON_STOCK".equals(stockType)) {
            i.setCurrentStock(BigDecimal.ZERO);
            i.setReorderPoint(BigDecimal.ZERO);
        } else {
            i.setCurrentStock(req.currentStock() != null ? req.currentStock() : BigDecimal.ZERO);
            i.setReorderPoint(req.reorderPoint() != null ? req.reorderPoint() : BigDecimal.ZERO);
        }
        i.setUnitCost(req.unitCost() != null ? req.unitCost() : BigDecimal.ZERO);
        i.setMinibarItem(Boolean.TRUE.equals(req.isMinibarItem()));
        i.setMinibarReorderThreshold(req.minibarReorderThreshold());
        i.setUnitOfMeasure(req.unitOfMeasure() != null && !req.unitOfMeasure().isBlank() ? req.unitOfMeasure().trim() : "piece");
        i.setType(i.isMinibarItem() ? InventoryItemType.MINIBAR_PRODUCT : InventoryItemType.CONSUMABLE);
        i.setPreferredSupplier(null);
        if (req.description() != null && !req.description().isBlank()) {
            i.setDescription(req.description().trim());
        }
        if (req.barcode() != null && !req.barcode().isBlank()) {
            i.setBarcode(req.barcode().trim());
        }
        if (req.sellingPrice() != null) {
            i.setSellingPrice(req.sellingPrice());
        }
        if (req.imageUrl() != null && !req.imageUrl().isBlank()) {
            i.setImageUrl(req.imageUrl().trim());
        }
        if (req.expiryDate() != null) {
            i.setExpiryDate(req.expiryDate());
        }
        if (req.manufactureDate() != null) {
            i.setManufactureDate(req.manufactureDate());
        }
        i = inventoryItemRepository.save(i);
        recordOpeningStockAtPrincipalWarehouse(hotelId, i);
        return new InventoryDtos.CreatedIdResponse(i.getId());
    }

    private static String normalizeStockType(String raw) {
        if (raw == null || raw.isBlank()) return "STOCK";
        String v = raw.trim().toUpperCase(Locale.ROOT).replace("-", "_").replace(" ", "_");
        if ("NON_STOCK".equals(v) || "NONSTOCK".equals(v)) return "NON_STOCK";
        if ("STOCK".equals(v)) return "STOCK";
        throw new ApiException(HttpStatus.BAD_REQUEST, "stockType must be STOCK or NON_STOCK");
    }

    private void recordOpeningStockAtPrincipalWarehouse(UUID hotelId, InventoryItem i) {
        BigDecimal opening = i.getCurrentStock();
        if (opening == null || opening.signum() <= 0) {
            return;
        }
        java.util.Optional<InvWarehouse> wh =
                invWarehouseRepository.findByHotel_IdAndCodeIgnoreCase(hotelId, "PRINCIPAL");
        if (wh.isEmpty()) {
            wh = invWarehouseRepository.findByHotel_IdAndIsDefaultTrue(hotelId);
        }
        if (wh.isEmpty()) {
            return;
        }
        StockTransaction st = new StockTransaction();
        st.setItem(i);
        st.setType(StockTransactionType.RECEIPT);
        st.setQuantity(opening);
        st.setReference("OPENING_BALANCE");
        st.setNotes("Initial stock at warehouse " + wh.get().getCode());
        st.setToLocation(wh.get().getCode());
        st.setPerformedBy(tenantAccessService.currentUser().getUsername());
        stockTransactionRepository.save(st);
    }

    private String generateUniqueSku(UUID hotelId) {
        for (int attempt = 0; attempt < 32; attempt++) {
            String candidate =
                    "SKU-"
                            + Year.now()
                            + "-"
                            + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
            if (inventoryItemRepository.findByHotel_IdAndSkuIgnoreCase(hotelId, candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate unique SKU");
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
