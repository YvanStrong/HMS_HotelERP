package com.hms.service;

import com.hms.api.dto.InventoryDtos;
import com.hms.domain.StockTransactionType;
import com.hms.entity.InvCustomer;
import com.hms.entity.InvSalesInvoice;
import com.hms.entity.InvSalesInvoiceItem;
import com.hms.entity.InvStockTransfer;
import com.hms.entity.InvStockTransferItem;
import com.hms.entity.InvWarehouse;
import com.hms.entity.InventoryItem;
import com.hms.entity.PurchaseOrder;
import com.hms.entity.StockTransaction;
import com.hms.entity.Supplier;
import com.hms.repository.InvCustomerRepository;
import com.hms.repository.InvSalesInvoiceRepository;
import com.hms.repository.InvStockTransferRepository;
import com.hms.repository.InvWarehouseRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.repository.PurchaseOrderLineRepository;
import com.hms.repository.PurchaseOrderRepository;
import com.hms.repository.StockTransactionRepository;
import com.hms.repository.SupplierRepository;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.util.QrCodeUtil;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvExtService {

    private final InventoryItemRepository itemRepository;
    private final StockTransactionRepository txRepository;
    private final SupplierRepository supplierRepository;
    private final PurchaseOrderRepository poRepository;
    private final InvWarehouseRepository warehouseRepository;
    private final InvCustomerRepository customerRepository;
    private final InvSalesInvoiceRepository invoiceRepository;
    private final InvStockTransferRepository transferRepository;
    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;
    private final PurchaseOrderLineRepository purchaseOrderLineRepository;

    public InvExtService(
            InventoryItemRepository itemRepository,
            StockTransactionRepository txRepository,
            SupplierRepository supplierRepository,
            PurchaseOrderRepository poRepository,
            InvWarehouseRepository warehouseRepository,
            InvCustomerRepository customerRepository,
            InvSalesInvoiceRepository invoiceRepository,
            InvStockTransferRepository transferRepository,
            HotelRepository hotelRepository,
            TenantAccessService tenantAccessService,
            PurchaseOrderLineRepository purchaseOrderLineRepository) {
        this.itemRepository = itemRepository;
        this.txRepository = txRepository;
        this.supplierRepository = supplierRepository;
        this.poRepository = poRepository;
        this.warehouseRepository = warehouseRepository;
        this.customerRepository = customerRepository;
        this.invoiceRepository = invoiceRepository;
        this.transferRepository = transferRepository;
        this.hotelRepository = hotelRepository;
        this.tenantAccessService = tenantAccessService;
        this.purchaseOrderLineRepository = purchaseOrderLineRepository;
    }

    // ── Supplier full detail ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public InventoryDtos.SupplierDetail getSupplier(UUID hotelId, String hotelHeader, UUID supplierId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Supplier s = supplierRepository.findByIdAndHotel_Id(supplierId, hotelId)
                .orElseThrow(() -> notFound("Supplier"));
        return toSupplierDetail(s);
    }

    @Transactional
    public InventoryDtos.SupplierDetail updateSupplier(UUID hotelId, String hotelHeader, UUID supplierId, InventoryDtos.SupplierUpdateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Supplier s = supplierRepository.findByIdAndHotel_Id(supplierId, hotelId)
                .orElseThrow(() -> notFound("Supplier"));
        if (req.contactPerson() != null) s.setContactPerson(req.contactPerson().trim());
        if (req.email() != null) s.setEmail(req.email().trim());
        if (req.phone() != null) s.setPhone(req.phone().trim());
        if (req.address() != null) s.setAddress(req.address().trim());
        if (req.taxId() != null) s.setTaxId(req.taxId().trim());
        if (req.paymentDetails() != null) s.setPaymentDetails(req.paymentDetails().trim());
        if (req.creditLimit() != null) s.setCreditLimit(req.creditLimit());
        s = supplierRepository.save(s);
        return toSupplierDetail(s);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.SupplierDetail> listSuppliersDetail(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return supplierRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(this::toSupplierDetail).toList();
    }

    private InventoryDtos.SupplierDetail toSupplierDetail(Supplier s) {
        return new InventoryDtos.SupplierDetail(
                s.getId(), s.getName(), s.getContactPerson(), s.getEmail(), s.getPhone(),
                s.getAddress(), s.getTaxId(), s.getPaymentDetails(),
                s.getRating(),
                s.getOutstandingBalance() != null ? s.getOutstandingBalance() : BigDecimal.ZERO,
                s.getCreditLimit() != null ? s.getCreditLimit() : BigDecimal.ZERO,
                s.getCreatedAt());
    }

    // ── Purchase order listing ────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<InventoryDtos.PurchaseOrderSummary> listPurchaseOrders(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return poRepository.findByHotel_IdOrderByOrderDateDesc(hotelId).stream()
                .map(po -> new InventoryDtos.PurchaseOrderSummary(
                        po.getId(), po.getPoNumber(),
                        po.getSupplier().getName(),
                        po.getStatus().name(),
                        po.getTotalAmount(),
                        po.getExpectedDelivery(),
                        po.getCreatedAt()))
                .toList();
    }

    // ── Stock adjustment ──────────────────────────────────────────────────

    @Transactional
    public InventoryDtos.StockAdjustResponse adjustStock(UUID hotelId, String hotelHeader, InventoryDtos.StockAdjustRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem item = itemRepository.findByIdAndHotel_Id(req.itemId(), hotelId)
                .orElseThrow(() -> notFound("Item"));
        if ("NON_STOCK".equalsIgnoreCase(item.getStockType())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Non-stock products cannot be adjusted");
        }
        BigDecimal before = item.getCurrentStock();
        BigDecimal after;
        String typeLabel = req.adjustmentType().trim().toUpperCase();
        switch (typeLabel) {
            case "ADD" -> {
                if (req.quantity() == null || req.quantity().signum() <= 0)
                    throw new ApiException(HttpStatus.BAD_REQUEST, "quantity must be positive for ADD");
                after = before.add(req.quantity());
            }
            case "REMOVE" -> {
                if (req.quantity() == null || req.quantity().signum() <= 0)
                    throw new ApiException(HttpStatus.BAD_REQUEST, "quantity must be positive for REMOVE");
                after = before.subtract(req.quantity());
                if (after.signum() < 0) after = BigDecimal.ZERO;
            }
            case "SET" -> {
                if (req.newQuantity() == null || req.newQuantity().signum() < 0)
                    throw new ApiException(HttpStatus.BAD_REQUEST, "newQuantity must be ≥ 0 for SET");
                after = req.newQuantity();
            }
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "adjustmentType must be ADD, REMOVE, or SET");
        }
        item.setCurrentStock(after);
        itemRepository.save(item);

        StockTransaction tx = new StockTransaction();
        tx.setItem(item);
        tx.setType(StockTransactionType.ADJUSTMENT);
        tx.setQuantity(after.subtract(before));
        tx.setReference(req.reason() != null ? req.reason().trim() : typeLabel);
        tx.setNotes(req.notes());
        tx.setPerformedBy(tenantAccessService.currentUser().getUsername());
        tx = txRepository.save(tx);

        return new InventoryDtos.StockAdjustResponse(
                item.getId(), item.getName(), item.getSku(),
                before, after, typeLabel, tx.getId());
    }

    // ── Stock movements listing ───────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<InventoryDtos.MovementItem> listMovements(UUID hotelId, String hotelHeader, UUID itemId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem item = itemRepository.findByIdAndHotel_Id(itemId, hotelId)
                .orElseThrow(() -> notFound("Item"));
        return txRepository.findByItem_IdOrderByTimestampDesc(item.getId()).stream()
                .map(t -> new InventoryDtos.MovementItem(
                        t.getId(), item.getName(), item.getSku(),
                        t.getType().name(), t.getQuantity(), t.getReference(),
                        t.getPerformedBy(), t.getNotes(), t.getTimestamp()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.MovementItem> listHotelMovements(UUID hotelId, String hotelHeader, int limit) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        int lim = Math.min(Math.max(limit, 1), 500);
        return txRepository.findRecentForHotel(hotelId, PageRequest.of(0, lim)).stream()
                .map(t -> new InventoryDtos.MovementItem(
                        t.getId(),
                        t.getItem().getName(),
                        t.getItem().getSku(),
                        t.getType().name(),
                        t.getQuantity(),
                        t.getReference(),
                        t.getPerformedBy(),
                        t.getNotes(),
                        t.getTimestamp()))
                .toList();
    }

    // ── Stock alerts ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public InventoryDtos.StockAlertSummary getAlerts(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<InventoryItem> allItems = itemRepository.findByHotel_IdAndActiveTrueOrderByNameAsc(hotelId);
        List<InventoryDtos.LowStockAlert> alerts = new ArrayList<>();
        int lowCount = 0, outCount = 0;
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (InventoryItem it : allItems) {
            BigDecimal stock = it.getCurrentStock();
            if (stock.signum() <= 0) {
                outCount++;
            } else if (it.getReorderPoint() != null && stock.compareTo(it.getReorderPoint()) < 0) {
                lowCount++;
            }
            String catName = it.getCategory() != null ? it.getCategory().getName() : null;
            if (it.getExpiryDate() != null && it.getExpiryDate().isBefore(today)) {
                alerts.add(new InventoryDtos.LowStockAlert(
                        it.getId(), it.getName(), it.getSku(), catName,
                        stock, it.getReorderPoint(), "EXPIRED"));
            } else if (it.getExpiryDate() != null && !it.getExpiryDate().isAfter(today.plusDays(30))) {
                alerts.add(new InventoryDtos.LowStockAlert(
                        it.getId(), it.getName(), it.getSku(), catName,
                        stock, it.getReorderPoint(), "EXPIRING_SOON"));
            }
            if (stock.signum() <= 0) {
                alerts.add(new InventoryDtos.LowStockAlert(
                        it.getId(), it.getName(), it.getSku(), catName,
                        stock, it.getReorderPoint(), "OUT_OF_STOCK"));
            } else if (it.getReorderPoint() != null && stock.compareTo(it.getReorderPoint()) < 0) {
                alerts.add(new InventoryDtos.LowStockAlert(
                        it.getId(), it.getName(), it.getSku(), catName,
                        stock, it.getReorderPoint(), "LOW_STOCK"));
            }
            if (it.getMaximumStock() != null && stock.compareTo(it.getMaximumStock()) > 0) {
                alerts.add(new InventoryDtos.LowStockAlert(
                        it.getId(), it.getName(), it.getSku(), catName,
                        stock, it.getReorderPoint(), "OVERSTOCK"));
            }
        }
        return new InventoryDtos.StockAlertSummary(lowCount, outCount, alerts);
    }

    // ── Barcode/QR generation ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public InventoryDtos.BarcodeResponse generateBarcode(UUID hotelId, String hotelHeader, UUID itemId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem item = itemRepository.findByIdAndHotel_Id(itemId, hotelId)
                .orElseThrow(() -> notFound("Item"));
        String barcodeValue = item.getBarcode() != null && !item.getBarcode().isBlank()
                ? item.getBarcode() : item.getSku();
        String qrDataUri = QrCodeUtil.toPngDataUri(barcodeValue);
        return new InventoryDtos.BarcodeResponse(item.getId(), item.getSku(), barcodeValue, qrDataUri);
    }

    // ── Warehouses ────────────────────────────────────────────────────────

    @Transactional
    public InventoryDtos.WarehouseItem createWarehouse(UUID hotelId, String hotelHeader, InventoryDtos.WarehouseCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String code = req.code().trim().toUpperCase();
        if (warehouseRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code))
            throw new ApiException(HttpStatus.CONFLICT, "Warehouse code already exists: " + code);
        InvWarehouse wh = new InvWarehouse();
        wh.setHotel(hotelRepository.getReferenceById(hotelId));
        wh.setName(req.name().trim());
        wh.setCode(code);
        wh.setAddress(req.address());
        wh.setDefault(req.isDefault() != null && req.isDefault());
        wh = warehouseRepository.save(wh);
        return toWarehouseItem(wh);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.WarehouseItem> listWarehouses(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<InvWarehouse> existing = warehouseRepository.findByHotel_IdAndActiveTrueOrderByNameAsc(hotelId);
        if (existing.isEmpty()) {
            InvWarehouse wh = new InvWarehouse();
            wh.setHotel(hotelRepository.getReferenceById(hotelId));
            wh.setName("Principal");
            wh.setCode("PRINCIPAL");
            wh.setAddress(null);
            wh.setDefault(true);
            wh.setActive(true);
            warehouseRepository.save(wh);
            existing = warehouseRepository.findByHotel_IdAndActiveTrueOrderByNameAsc(hotelId);
        }
        return existing.stream().map(this::toWarehouseItem).toList();
    }

    private InventoryDtos.WarehouseItem toWarehouseItem(InvWarehouse wh) {
        return new InventoryDtos.WarehouseItem(wh.getId(), wh.getName(), wh.getCode(), wh.getAddress(), wh.isDefault(), wh.isActive());
    }

    // ── Customers ─────────────────────────────────────────────────────────

    @Transactional
    public InventoryDtos.CustomerItem createCustomer(UUID hotelId, String hotelHeader, InventoryDtos.CustomerCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InvCustomer c = new InvCustomer();
        c.setHotel(hotelRepository.getReferenceById(hotelId));
        c.setName(req.name().trim());
        c.setCode(req.code() != null ? req.code().trim().toUpperCase() : null);
        c.setPhone(req.phone());
        c.setEmail(req.email());
        c.setAddress(req.address());
        c.setCreditLimit(req.creditLimit() != null ? req.creditLimit() : BigDecimal.ZERO);
        c = customerRepository.save(c);
        return toCustomerItem(c);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.CustomerItem> listCustomers(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return customerRepository.findByHotel_IdAndActiveTrueOrderByNameAsc(hotelId).stream()
                .map(this::toCustomerItem).toList();
    }

    private InventoryDtos.CustomerItem toCustomerItem(InvCustomer c) {
        return new InventoryDtos.CustomerItem(c.getId(), c.getName(), c.getCode(), c.getPhone(), c.getEmail(), c.getCreditLimit(), c.getOutstandingBalance(), c.isActive());
    }

    // ── Sales Invoices ────────────────────────────────────────────────────

    @Transactional
    public InventoryDtos.SalesInvoiceItem createSalesInvoice(UUID hotelId, String hotelHeader, InventoryDtos.SalesInvoiceCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.lines() == null || req.lines().isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "At least one line item is required");

        InvSalesInvoice inv = new InvSalesInvoice();
        inv.setHotel(hotelRepository.getReferenceById(hotelId));
        if (req.customerId() != null) {
            inv.setCustomer(customerRepository.findByIdAndHotel_Id(req.customerId(), hotelId)
                    .orElseThrow(() -> notFound("Customer")));
            inv.setCustomerName(inv.getCustomer().getName());
        } else {
            inv.setCustomerName(req.customerName() != null ? req.customerName().trim() : "Walk-in");
        }
        inv.setInvoiceNumber(generateInvoiceNumber());
        inv.setStatus("DRAFT");
        inv.setInvoiceDate(req.invoiceDate() != null ? req.invoiceDate() : LocalDate.now());
        inv.setDueDate(req.dueDate());
        inv.setNotes(req.notes());
        inv.setPaymentMethod(req.paymentMethod());
        inv.setCreatedBy(tenantAccessService.currentUser().getUsername());
        inv.setDiscountAmount(req.discountAmount() != null ? req.discountAmount() : BigDecimal.ZERO);

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;
        List<InvSalesInvoiceItem> lineEntities = new ArrayList<>();

        for (InventoryDtos.SalesInvoiceLineInput line : req.lines()) {
            InventoryItem item = itemRepository.findByIdAndHotel_Id(line.itemId(), hotelId)
                    .orElseThrow(() -> notFound("Item " + line.itemId()));
            BigDecimal qty = line.quantity() != null ? line.quantity() : BigDecimal.ONE;
            BigDecimal price = line.unitPrice() != null ? line.unitPrice() : item.getUnitCost();
            BigDecimal discPct = line.discountPct() != null ? line.discountPct() : BigDecimal.ZERO;
            BigDecimal taxRate = line.taxRate() != null ? line.taxRate() : BigDecimal.ZERO;
            BigDecimal lineSubtotal = qty.multiply(price)
                    .multiply(BigDecimal.ONE.subtract(discPct.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)))
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTax = lineSubtotal.multiply(taxRate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)).setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineSubtotal);
            taxTotal = taxTotal.add(lineTax);

            InvSalesInvoiceItem li = new InvSalesInvoiceItem();
            li.setInvoice(inv);
            li.setItem(item);
            li.setItemName(item.getName());
            li.setQuantity(qty);
            li.setUnitPrice(price);
            li.setDiscountPct(discPct);
            li.setTaxRate(taxRate);
            li.setSubtotal(lineSubtotal.add(lineTax));
            li.setCostPrice(item.getUnitCost());
            lineEntities.add(li);
        }

        BigDecimal discount = inv.getDiscountAmount();
        BigDecimal total = subtotal.add(taxTotal).subtract(discount).max(BigDecimal.ZERO);
        inv.setSubtotal(subtotal);
        inv.setTaxAmount(taxTotal);
        inv.setTotalAmount(total);
        inv.getItems().addAll(lineEntities);
        inv = invoiceRepository.save(inv);
        return toInvoiceItem(inv);
    }

    @Transactional
    public InventoryDtos.SalesInvoiceItem issueInvoice(UUID hotelId, String hotelHeader, UUID invoiceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InvSalesInvoice inv = invoiceRepository.findByIdAndHotel_Id(invoiceId, hotelId)
                .orElseThrow(() -> notFound("Invoice"));
        if (!"DRAFT".equals(inv.getStatus()))
            throw new ApiException(HttpStatus.CONFLICT, "Only DRAFT invoices can be issued");

        for (InvSalesInvoiceItem li : inv.getItems()) {
            InventoryItem item = li.getItem();
            BigDecimal newStock = item.getCurrentStock().subtract(li.getQuantity());
            if (newStock.signum() < 0) newStock = BigDecimal.ZERO;
            item.setCurrentStock(newStock);
            itemRepository.save(item);

            StockTransaction tx = new StockTransaction();
            tx.setItem(item);
            tx.setType(StockTransactionType.CONSUMPTION);
            tx.setQuantity(li.getQuantity().negate());
            tx.setReference("INVOICE-" + inv.getInvoiceNumber());
            tx.setPerformedBy(tenantAccessService.currentUser().getUsername());
            txRepository.save(tx);
        }
        inv.setStatus("ISSUED");
        if (inv.getPaymentMethod() != null && !inv.getPaymentMethod().isBlank() && !"CREDIT".equalsIgnoreCase(inv.getPaymentMethod())) {
            inv.setAmountPaid(inv.getTotalAmount());
            inv.setStatus("PAID");
        }
        inv = invoiceRepository.save(inv);
        return toInvoiceItem(inv);
    }

    @Transactional
    public InventoryDtos.SalesInvoiceItem recordPayment(UUID hotelId, String hotelHeader, UUID invoiceId, InventoryDtos.SalesPaymentRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InvSalesInvoice inv = invoiceRepository.findByIdAndHotel_Id(invoiceId, hotelId)
                .orElseThrow(() -> notFound("Invoice"));
        if ("CANCELLED".equals(inv.getStatus()))
            throw new ApiException(HttpStatus.CONFLICT, "Cannot record payment on a cancelled invoice");
        BigDecimal newPaid = inv.getAmountPaid().add(req.amount());
        inv.setAmountPaid(newPaid.min(inv.getTotalAmount()));
        inv.setPaymentMethod(req.paymentMethod());
        if (inv.getAmountPaid().compareTo(inv.getTotalAmount()) >= 0) {
            inv.setStatus("PAID");
        } else if (inv.getAmountPaid().signum() > 0) {
            inv.setStatus("PARTIAL");
        }
        inv = invoiceRepository.save(inv);
        return toInvoiceItem(inv);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.SalesInvoiceSummary> listSalesInvoices(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return invoiceRepository.findByHotel_IdOrderByInvoiceDateDescCreatedAtDesc(hotelId).stream()
                .map(inv -> new InventoryDtos.SalesInvoiceSummary(
                        inv.getId(), inv.getInvoiceNumber(), inv.getStatus(), inv.getCustomerName(),
                        inv.getInvoiceDate(), inv.getTotalAmount(), inv.getAmountPaid(),
                        inv.getTotalAmount().subtract(inv.getAmountPaid()), inv.getPaymentMethod()))
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryDtos.SalesInvoiceItem getSalesInvoice(UUID hotelId, String hotelHeader, UUID invoiceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InvSalesInvoice inv = invoiceRepository.findByIdAndHotel_Id(invoiceId, hotelId)
                .orElseThrow(() -> notFound("Invoice"));
        return toInvoiceItem(inv);
    }

    private InventoryDtos.SalesInvoiceItem toInvoiceItem(InvSalesInvoice inv) {
        List<InventoryDtos.SalesInvoiceLineItem> lines = inv.getItems().stream().map(li -> {
            BigDecimal profit = li.getCostPrice() != null
                    ? li.getSubtotal().subtract(li.getCostPrice().multiply(li.getQuantity()).setScale(2, RoundingMode.HALF_UP))
                    : null;
            return new InventoryDtos.SalesInvoiceLineItem(
                    li.getId(), li.getItemName(),
                    li.getItem() != null ? li.getItem().getSku() : null,
                    li.getQuantity(), li.getUnitPrice(), li.getDiscountPct(), li.getTaxRate(),
                    li.getSubtotal(), profit);
        }).toList();
        BigDecimal totalProfit = lines.stream()
                .filter(l -> l.profit() != null)
                .map(InventoryDtos.SalesInvoiceLineItem::profit)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new InventoryDtos.SalesInvoiceItem(
                inv.getId(), inv.getInvoiceNumber(), inv.getStatus(), inv.getCustomerName(),
                inv.getInvoiceDate(), inv.getDueDate(),
                inv.getSubtotal(), inv.getDiscountAmount(), inv.getTaxAmount(),
                inv.getTotalAmount(), inv.getAmountPaid(),
                inv.getTotalAmount().subtract(inv.getAmountPaid()),
                inv.getPaymentMethod(), lines, totalProfit, inv.getCreatedAt());
    }

    // ── Stock transfers ───────────────────────────────────────────────────

    @Transactional
    public InventoryDtos.TransferItem createTransfer(UUID hotelId, String hotelHeader, InventoryDtos.TransferCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.items() == null || req.items().isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Transfer must have at least one item");
        InvWarehouse from = warehouseRepository.findByIdAndHotel_Id(req.fromWarehouseId(), hotelId)
                .orElseThrow(() -> notFound("Source warehouse"));
        InvWarehouse to = warehouseRepository.findByIdAndHotel_Id(req.toWarehouseId(), hotelId)
                .orElseThrow(() -> notFound("Destination warehouse"));
        if (from.getId().equals(to.getId()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Source and destination warehouse must be different");

        InvStockTransfer transfer = new InvStockTransfer();
        transfer.setHotel(hotelRepository.getReferenceById(hotelId));
        transfer.setFromWarehouse(from);
        transfer.setToWarehouse(to);
        transfer.setTransferNumber(generateTransferNumber());
        transfer.setStatus("PENDING");
        transfer.setNotes(req.notes());
        transfer.setTransferredBy(tenantAccessService.currentUser().getUsername());

        for (InventoryDtos.TransferLineInput li : req.items()) {
            InventoryItem item = itemRepository.findByIdAndHotel_Id(li.itemId(), hotelId)
                    .orElseThrow(() -> notFound("Item " + li.itemId()));
            InvStockTransferItem ti = new InvStockTransferItem();
            ti.setTransfer(transfer);
            ti.setItem(item);
            ti.setQuantity(li.quantity() != null ? li.quantity() : BigDecimal.ONE);
            ti.setUnitCost(item.getUnitCost());
            transfer.getItems().add(ti);
        }
        transfer = transferRepository.save(transfer);
        return toTransferItem(transfer);
    }

    @Transactional
    public InventoryDtos.TransferItem completeTransfer(UUID hotelId, String hotelHeader, UUID transferId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InvStockTransfer transfer = transferRepository.findByIdAndHotel_Id(transferId, hotelId)
                .orElseThrow(() -> notFound("Transfer"));
        if (!"PENDING".equals(transfer.getStatus()))
            throw new ApiException(HttpStatus.CONFLICT, "Only PENDING transfers can be completed");

        String who = tenantAccessService.currentUser().getUsername();
        for (InvStockTransferItem ti : transfer.getItems()) {
            InventoryItem item = ti.getItem();
            BigDecimal qty = ti.getQuantity();

            StockTransaction txOut = new StockTransaction();
            txOut.setItem(item);
            txOut.setType(StockTransactionType.TRANSFER);
            txOut.setQuantity(qty.negate());
            txOut.setReference("TRF-" + transfer.getTransferNumber());
            txOut.setFromLocation(transfer.getFromWarehouse().getName());
            txOut.setNotes("Internal transfer out");
            txOut.setPerformedBy(who);
            txRepository.save(txOut);

            StockTransaction txIn = new StockTransaction();
            txIn.setItem(item);
            txIn.setType(StockTransactionType.TRANSFER);
            txIn.setQuantity(qty);
            txIn.setReference("TRF-" + transfer.getTransferNumber());
            txIn.setToLocation(transfer.getToWarehouse().getName());
            txIn.setNotes("Internal transfer in");
            txIn.setPerformedBy(who);
            txRepository.save(txIn);
        }
        transfer.setStatus("COMPLETED");
        transfer.setCompletedAt(Instant.now());
        transfer = transferRepository.save(transfer);
        return toTransferItem(transfer);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.TransferItem> listTransfers(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return transferRepository.findByHotel_IdOrderByTransferDateDescCreatedAtDesc(hotelId).stream()
                .map(this::toTransferItem).toList();
    }

    private InventoryDtos.TransferItem toTransferItem(InvStockTransfer t) {
        List<InventoryDtos.TransferLineItem> lines = t.getItems().stream()
                .map(ti -> new InventoryDtos.TransferLineItem(
                        ti.getItem().getId(), ti.getItem().getName(), ti.getItem().getSku(), ti.getQuantity()))
                .toList();
        return new InventoryDtos.TransferItem(
                t.getId(), t.getTransferNumber(), t.getStatus(),
                t.getFromWarehouse().getName(), t.getToWarehouse().getName(),
                t.getTransferDate(), lines,
                t.getTransferredBy(), t.getCreatedAt(), t.getCompletedAt());
    }

    // ── Dashboard ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public InventoryDtos.InvDashboardResponse getDashboard(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        long totalProducts = itemRepository.countByHotel_IdAndActiveTrue(hotelId);
        BigDecimal stockValue = itemRepository.sumStockValue(hotelId);
        long lowStock = itemRepository.countLowStock(hotelId);
        long outOfStock = itemRepository.countOutOfStock(hotelId);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        BigDecimal todaySales = invoiceRepository.sumTodaySales(hotelId, today);
        BigDecimal todayPurchases = poRepository.findByHotel_IdOrderByOrderDateDesc(hotelId).stream()
                .filter(po -> {
                    LocalDate d = po.getOrderDate().atZone(ZoneOffset.UTC).toLocalDate();
                    return d.equals(today);
                })
                .map(PurchaseOrder::getTotalAmount)
                .filter(a -> a != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long pendingPO = poRepository.countOpenByHotel(hotelId);
        long totalSuppliers = supplierRepository.countByHotel_Id(hotelId);
        long totalCustomers = customerRepository.findByHotel_IdAndActiveTrueOrderByNameAsc(hotelId).size();

        List<InventoryDtos.DashboardItem> lowItems = itemRepository.findByHotel_IdAndActiveTrueOrderByNameAsc(hotelId).stream()
                .filter(i -> i.getCurrentStock().signum() <= 0 ||
                        (i.getReorderPoint() != null && i.getCurrentStock().compareTo(i.getReorderPoint()) < 0))
                .limit(8)
                .map(i -> new InventoryDtos.DashboardItem(
                        i.getId(), i.getName(), i.getSku(),
                        i.getCurrentStock().multiply(i.getUnitCost() != null ? i.getUnitCost() : BigDecimal.ZERO)))
                .toList();

        return new InventoryDtos.InvDashboardResponse(
                totalProducts,
                stockValue,
                lowStock,
                outOfStock,
                todaySales,
                todayPurchases,
                pendingPO,
                totalSuppliers,
                totalCustomers,
                lowItems,
                List.of(),
                List.of());
    }

    // ── Reports ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public InventoryDtos.SalesReport getSalesReport(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate f = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate t = to != null ? to : LocalDate.now();
        List<InvSalesInvoice> invoices = invoiceRepository.findByHotel_IdOrderByInvoiceDateDescCreatedAtDesc(hotelId)
                .stream()
                .filter(inv -> !inv.getInvoiceDate().isBefore(f) && !inv.getInvoiceDate().isAfter(t))
                .toList();
        BigDecimal totalRevenue = invoices.stream()
                .filter(i -> !"CANCELLED".equals(i.getStatus()))
                .map(InvSalesInvoice::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPaid = invoices.stream()
                .filter(i -> !"CANCELLED".equals(i.getStatus()))
                .map(InvSalesInvoice::getAmountPaid)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<InventoryDtos.SalesReportLine> lines = invoices.stream()
                .map(inv -> new InventoryDtos.SalesReportLine(
                        inv.getId(), inv.getInvoiceNumber(), inv.getInvoiceDate(),
                        inv.getCustomerName(), inv.getTotalAmount(), inv.getAmountPaid(),
                        inv.getStatus(), inv.getPaymentMethod()))
                .toList();
        return new InventoryDtos.SalesReport(f, t, totalRevenue, totalPaid, (long) invoices.size(), lines);
    }

    @Transactional(readOnly = true)
    public InventoryDtos.PurchaseReport getPurchaseReport(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate f = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate t = to != null ? to : LocalDate.now();
        List<PurchaseOrder> pos = poRepository.findByHotel_IdOrderByOrderDateDesc(hotelId).stream()
                .filter(po -> {
                    LocalDate d = po.getOrderDate().atZone(java.time.ZoneOffset.UTC).toLocalDate();
                    return !d.isBefore(f) && !d.isAfter(t);
                }).toList();
        BigDecimal total = pos.stream().map(PurchaseOrder::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<InventoryDtos.PurchaseReportLine> lines = pos.stream()
                .map(po -> new InventoryDtos.PurchaseReportLine(
                        po.getId(), po.getPoNumber(),
                        po.getOrderDate().atZone(java.time.ZoneOffset.UTC).toLocalDate(),
                        po.getSupplier().getName(),
                        po.getTotalAmount(), po.getStatus().name(),
                        po.getPaymentTerms() != null ? po.getPaymentTerms().name() : null))
                .toList();
        return new InventoryDtos.PurchaseReport(f, t, total, (long) pos.size(), lines);
    }

    @Transactional(readOnly = true)
    public InventoryDtos.StockValueReport getStockValueReport(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<InventoryItem> items = itemRepository.findByHotel_IdAndActiveTrueOrderByNameAsc(hotelId);
        List<InventoryDtos.StockValueItem> valueItems = items.stream().map(i -> {
            BigDecimal cost = i.getUnitCost() != null ? i.getUnitCost() : BigDecimal.ZERO;
            BigDecimal val = i.getCurrentStock().multiply(cost).setScale(2, RoundingMode.HALF_UP);
            String cat = i.getCategory() != null ? i.getCategory().getName() : null;
            return new InventoryDtos.StockValueItem(i.getId(), i.getName(), i.getSku(), cat, i.getCurrentStock(), cost, val);
        }).toList();
        BigDecimal grand = valueItems.stream().map(InventoryDtos.StockValueItem::totalValue).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new InventoryDtos.StockValueReport(grand, valueItems.size(), valueItems);
    }

    @Transactional
    public void recordPurchaseReturn(
            UUID hotelId, String hotelHeader, UUID poId, InventoryDtos.PurchaseReturnRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PurchaseOrder po = poRepository.findByIdAndHotel_Id(poId, hotelId).orElseThrow(() -> notFound("Purchase order"));
        if (req.lines() == null || req.lines().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Return lines required");
        }
        String who = tenantAccessService.currentUser().getUsername();
        for (InventoryDtos.PurchaseReturnLineInput line : req.lines()) {
            var pl = purchaseOrderLineRepository
                    .findByIdAndPurchaseOrder_Hotel_Id(line.poLineId(), hotelId)
                    .orElseThrow(() -> notFound("PO line"));
            if (!pl.getPurchaseOrder().getId().equals(po.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Line does not belong to this purchase order");
            }
            BigDecimal qty = line.quantity();
            if (qty == null || qty.signum() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Each return quantity must be positive");
            }
            InventoryItem item = pl.getItem();
            BigDecimal newStock = item.getCurrentStock().subtract(qty);
            if (newStock.signum() < 0) {
                newStock = BigDecimal.ZERO;
            }
            item.setCurrentStock(newStock);
            itemRepository.save(item);

            StockTransaction tx = new StockTransaction();
            tx.setItem(item);
            tx.setType(StockTransactionType.ADJUSTMENT);
            tx.setQuantity(qty.negate());
            tx.setReference("PO_RETURN:" + po.getPoNumber());
            tx.setNotes(req.notes());
            tx.setPerformedBy(who);
            txRepository.save(tx);
        }
    }

    @Transactional
    public InventoryDtos.SalesInvoiceItem returnSalesInvoiceFull(UUID hotelId, String hotelHeader, UUID invoiceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InvSalesInvoice inv = invoiceRepository.findByIdAndHotel_Id(invoiceId, hotelId).orElseThrow(() -> notFound("Invoice"));
        if (!Set.of("ISSUED", "PAID", "PARTIAL").contains(inv.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Only posted invoices can be returned");
        }
        String who = tenantAccessService.currentUser().getUsername();
        for (InvSalesInvoiceItem li : inv.getItems()) {
            InventoryItem item = li.getItem();
            item.setCurrentStock(item.getCurrentStock().add(li.getQuantity()));
            itemRepository.save(item);
            StockTransaction tx = new StockTransaction();
            tx.setItem(item);
            tx.setType(StockTransactionType.ADJUSTMENT);
            tx.setQuantity(li.getQuantity());
            tx.setReference("SALES_RETURN:" + inv.getInvoiceNumber());
            tx.setNotes("Full invoice return");
            tx.setPerformedBy(who);
            txRepository.save(tx);
        }
        inv.setStatus("RETURNED");
        inv.setAmountPaid(BigDecimal.ZERO);
        inv = invoiceRepository.save(inv);
        return toInvoiceItem(inv);
    }

    @Transactional(readOnly = true)
    public InventoryDtos.ProfitReport getProfitReport(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate f = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate t = to != null ? to : LocalDate.now();
        List<InvSalesInvoice> invoices = invoiceRepository.findByHotel_IdOrderByInvoiceDateDescCreatedAtDesc(hotelId).stream()
                .filter(inv -> !inv.getInvoiceDate().isBefore(f)
                        && !inv.getInvoiceDate().isAfter(t)
                        && !"CANCELLED".equals(inv.getStatus())
                        && !"DRAFT".equals(inv.getStatus()))
                .toList();
        List<InventoryDtos.ProfitReportLine> lines = new ArrayList<>();
        BigDecimal totalRev = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        for (InvSalesInvoice inv : invoices) {
            BigDecimal invCost = BigDecimal.ZERO;
            for (InvSalesInvoiceItem li : inv.getItems()) {
                BigDecimal lineCost = li.getCostPrice() != null
                        ? li.getCostPrice().multiply(li.getQuantity()).setScale(2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                invCost = invCost.add(lineCost);
            }
            BigDecimal invRev = inv.getTotalAmount() != null ? inv.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal profit = invRev.subtract(invCost).setScale(2, RoundingMode.HALF_UP);
            lines.add(new InventoryDtos.ProfitReportLine(
                    inv.getId(),
                    inv.getInvoiceNumber(),
                    inv.getInvoiceDate(),
                    inv.getCustomerName(),
                    invRev,
                    invCost,
                    profit));
            totalRev = totalRev.add(invRev);
            totalCost = totalCost.add(invCost);
        }
        BigDecimal totalProfit = totalRev.subtract(totalCost).setScale(2, RoundingMode.HALF_UP);
        return new InventoryDtos.ProfitReport(f, t, totalRev, totalCost, totalProfit, lines);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.ExpiredProductLine> listExpiredProducts(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return itemRepository
                .findByHotel_IdAndActiveTrueAndExpiryDateIsNotNullAndExpiryDateBeforeOrderByExpiryDateAsc(hotelId, today)
                .stream()
                .map(i -> new InventoryDtos.ExpiredProductLine(
                        i.getId(), i.getName(), i.getSku(), i.getExpiryDate(), i.getCurrentStock()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.UserActivityLine> listUserActivity(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Map<String, Long> counts = new HashMap<>();
        for (InventoryDtos.MovementItem m : listHotelMovements(hotelId, hotelHeader, 800)) {
            String u = m.performedBy() != null ? m.performedBy() : "—";
            counts.merge(u, 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(e -> new InventoryDtos.UserActivityLine(e.getKey(), e.getValue()))
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static String generateInvoiceNumber() {
        String year = String.valueOf(java.time.Year.now().getValue());
        String rand = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "INV-" + year + "-" + rand;
    }

    private static String generateTransferNumber() {
        String year = String.valueOf(java.time.Year.now().getValue());
        String rand = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "TRF-" + year + "-" + rand;
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
