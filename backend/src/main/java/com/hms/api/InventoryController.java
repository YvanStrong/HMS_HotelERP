package com.hms.api;

import com.hms.api.dto.InventoryDtos;
import com.hms.api.dto.InventoryDepotDtos;
import com.hms.service.InvExtService;
import com.hms.service.InventoryDepotService;
import com.hms.service.InventoryService;
import com.hms.security.CheckModuleEntitlement;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/inventory")
@CheckModuleEntitlement("INVENTORY")
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryDepotService inventoryDepotService;
    private final InvExtService invExtService;

    public InventoryController(
            InventoryService inventoryService,
            InventoryDepotService inventoryDepotService,
            InvExtService invExtService) {
        this.inventoryService = inventoryService;
        this.inventoryDepotService = inventoryDepotService;
        this.invExtService = invExtService;
    }

    @PostMapping("/suppliers")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<InventoryDtos.CreatedIdResponse> createSupplier(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.SupplierCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createSupplier(hotelId, hotelHeader, body));
    }

    @GetMapping("/suppliers")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_HOUSEKEEPING')")
    public java.util.List<InventoryDtos.SupplierSummary> listSuppliers(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryService.listSuppliers(hotelId, hotelHeader);
    }

    @PostMapping("/categories")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<InventoryDtos.CreatedIdResponse> createCategory(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.CategoryCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createCategory(hotelId, hotelHeader, body));
    }

    @GetMapping("/categories")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_HOUSEKEEPING')")
    public java.util.List<InventoryDtos.CategorySummary> listCategories(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryService.listCategories(hotelId, hotelHeader);
    }

    @PostMapping("/items")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<InventoryDtos.CreatedIdResponse> createItem(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.InventoryItemCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createItem(hotelId, hotelHeader, body));
    }

    @GetMapping("/items")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_HOUSEKEEPING')")
    public InventoryDtos.InventoryItemsResponse listItems(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean lowStock,
            @RequestParam(required = false) String search) {
        return inventoryService.listItems(hotelId, hotelHeader, category, lowStock, search);
    }

    @GetMapping("/items/lookup")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDtos.InventoryItemRow lookupItem(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String barcode) {
        return inventoryService.lookupProduct(hotelId, hotelHeader, sku, barcode);
    }

    @GetMapping("/items/{itemId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_HOUSEKEEPING')")
    public InventoryDtos.InventoryItemRow getItem(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryService.getItem(hotelId, hotelHeader, itemId);
    }

    @PatchMapping("/items/{itemId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.InventoryItemRow patchItem(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody InventoryDtos.InventoryItemPatchRequest body) {
        return inventoryService.patchItem(hotelId, hotelHeader, itemId, body);
    }

    @PostMapping("/items/{itemId}/consume")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_HOUSEKEEPING','ROLE_RECEPTIONIST')")
    public InventoryDtos.ConsumeResponse consume(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.ConsumeRequest body) {
        return inventoryService.consume(hotelId, hotelHeader, itemId, body);
    }

    @PostMapping("/purchase-orders")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<InventoryDtos.CreatePurchaseOrderResponse> createPurchaseOrder(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.CreatePurchaseOrderRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createPurchaseOrder(hotelId, hotelHeader, body));
    }

    @PostMapping("/items/{itemId}/receive")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.ReceiveGoodsResponse receive(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.ReceiveGoodsRequest body) {
        return inventoryService.receiveGoods(hotelId, hotelHeader, itemId, body);
    }

    @GetMapping("/depots")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public java.util.List<InventoryDepotDtos.DepotRow> listDepots(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.listDepots(hotelId, hotelHeader);
    }

    @PostMapping("/depots/bootstrap")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public java.util.List<InventoryDepotDtos.DepotRow> bootstrapDepots(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.bootstrapDefaults(hotelId, hotelHeader);
    }

    @PostMapping("/depots")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<InventoryDepotDtos.CreateDepotResponse> createDepot(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDepotDtos.CreateDepotRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryDepotService.createDepot(hotelId, hotelHeader, body));
    }

    @PostMapping("/depot-products")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public ResponseEntity<InventoryDepotDtos.CreateDepotProductResponse> createDepotProduct(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDepotDtos.CreateDepotProductRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryDepotService.createProduct(hotelId, hotelHeader, body));
    }

    @PatchMapping("/depot-products/{productId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDepotDtos.DepotProductRow patchDepotProduct(
            @PathVariable UUID hotelId,
            @PathVariable UUID productId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody InventoryDepotDtos.PatchDepotProductRequest body) {
        return inventoryDepotService.patchProduct(hotelId, hotelHeader, productId, body);
    }

    @GetMapping("/depot-products")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public java.util.List<InventoryDepotDtos.DepotProductRow> listDepotProducts(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId,
            @RequestParam(required = false) String menu,
            @RequestParam(defaultValue = "true") boolean activeOnly) {
        return inventoryDepotService.listProducts(hotelId, hotelHeader, depotId, menu, activeOnly);
    }

    @PostMapping("/sales")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public ResponseEntity<InventoryDepotDtos.CreateSaleResponse> createSale(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDepotDtos.CreateSaleRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryDepotService.createSale(hotelId, hotelHeader, body));
    }

    @GetMapping("/sales")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public java.util.List<InventoryDepotDtos.SaleRow> listSales(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId) {
        return inventoryDepotService.listSales(hotelId, hotelHeader, depotId);
    }

    @GetMapping("/sales/{saleId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.SaleDetailResponse getSale(
            @PathVariable UUID hotelId,
            @PathVariable UUID saleId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.getSaleDetail(hotelId, hotelHeader, saleId);
    }

    /** Same as {@link #getSale} but query param — avoids some proxies/path issues with UUID in the last path segment. */
    @GetMapping("/sales/detail")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.SaleDetailResponse getSaleDetailQuery(
            @PathVariable UUID hotelId,
            @RequestParam("saleId") UUID saleId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.getSaleDetail(hotelId, hotelHeader, saleId);
    }

    @PostMapping("/deliveries")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public ResponseEntity<InventoryDepotDtos.CreateDeliveryOrderResponse> createDeliveryOrder(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDepotDtos.CreateDeliveryOrderRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryDepotService.createDeliveryOrder(hotelId, hotelHeader, body));
    }

    @GetMapping("/deliveries")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public java.util.List<InventoryDepotDtos.DeliveryOrderRow> listDeliveryOrders(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String status) {
        return inventoryDepotService.listDeliveryOrders(hotelId, hotelHeader, status);
    }

    @GetMapping("/deliveries/{deliveryOrderId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.DeliveryOrderDetailResponse getDeliveryOrder(
            @PathVariable UUID hotelId,
            @PathVariable UUID deliveryOrderId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.getDeliveryOrderDetail(hotelId, hotelHeader, deliveryOrderId);
    }

    @PostMapping("/deliveries/{deliveryOrderId}/convert-to-invoice")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.CreateSaleResponse convertDeliveryToInvoice(
            @PathVariable UUID hotelId,
            @PathVariable UUID deliveryOrderId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.convertDeliveryToSale(hotelId, hotelHeader, deliveryOrderId);
    }

    @PostMapping("/proformas")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public ResponseEntity<InventoryDepotDtos.CreateProformaResponse> createPosProforma(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDepotDtos.CreateSaleRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryDepotService.createProforma(hotelId, hotelHeader, body));
    }

    @GetMapping("/proformas")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public java.util.List<InventoryDepotDtos.ProformaRow> listPosProformas(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId) {
        return inventoryDepotService.listPosProformas(hotelId, hotelHeader, depotId);
    }

    @GetMapping("/proformas/{proformaId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.ProformaDetailResponse getPosProforma(
            @PathVariable UUID hotelId,
            @PathVariable UUID proformaId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.getPosProformaDetail(hotelId, hotelHeader, proformaId);
    }

    @PostMapping("/proformas/{proformaId}/convert-to-invoice")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.CreateSaleResponse convertPosProformaToInvoice(
            @PathVariable UUID hotelId,
            @PathVariable UUID proformaId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.convertProformaToSale(hotelId, hotelHeader, proformaId);
    }

    // ── Inventory extensions (ERP): suppliers detail, PO list, stock, warehouses, sales invoices, reports ──

    @GetMapping("/suppliers/detail")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public List<InventoryDtos.SupplierDetail> listSuppliersDetail(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listSuppliersDetail(hotelId, hotelHeader);
    }

    @GetMapping("/suppliers/{supplierId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.SupplierDetail getSupplier(
            @PathVariable UUID hotelId,
            @PathVariable UUID supplierId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.getSupplier(hotelId, hotelHeader, supplierId);
    }

    @PatchMapping("/suppliers/{supplierId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.SupplierDetail updateSupplier(
            @PathVariable UUID hotelId,
            @PathVariable UUID supplierId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody InventoryDtos.SupplierUpdateRequest body) {
        return invExtService.updateSupplier(hotelId, hotelHeader, supplierId, body);
    }

    @GetMapping("/purchase-orders")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public List<InventoryDtos.PurchaseOrderSummary> listPurchaseOrders(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listPurchaseOrders(hotelId, hotelHeader);
    }

    @PostMapping("/purchase-orders/{poId}/returns")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<Void> purchaseReturn(
            @PathVariable UUID hotelId,
            @PathVariable UUID poId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.PurchaseReturnRequest body) {
        invExtService.recordPurchaseReturn(hotelId, hotelHeader, poId, body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/stock/adjust")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.StockAdjustResponse adjustStock(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.StockAdjustRequest body) {
        return invExtService.adjustStock(hotelId, hotelHeader, body);
    }

    @GetMapping("/fabrication/formulas")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public List<InventoryDtos.FabricationFormulaItem> listFabricationFormulas(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listFabricationFormulas(hotelId, hotelHeader);
    }

    @PostMapping("/fabrication/formulas")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<InventoryDtos.FabricationFormulaItem> createFabricationFormula(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.FabricationFormulaCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invExtService.createFabricationFormula(hotelId, hotelHeader, body));
    }

    @PostMapping("/fabrication/runs")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public ResponseEntity<InventoryDtos.FabricationRunItem> runFabrication(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.FabricationRunRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invExtService.runFabrication(hotelId, hotelHeader, body));
    }

    @GetMapping("/fabrication/runs")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public List<InventoryDtos.FabricationRunItem> listFabricationRuns(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "50") int limit) {
        return invExtService.listFabricationRuns(hotelId, hotelHeader, limit);
    }

    @GetMapping("/items/{itemId}/movements")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public List<InventoryDtos.MovementItem> listItemMovements(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listMovements(hotelId, hotelHeader, itemId);
    }

    @GetMapping("/movements")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public List<InventoryDtos.MovementItem> listHotelMovements(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "200") int limit) {
        return invExtService.listHotelMovements(hotelId, hotelHeader, limit);
    }

    @GetMapping("/alerts")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public InventoryDtos.StockAlertSummary stockAlerts(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.getAlerts(hotelId, hotelHeader);
    }

    @GetMapping("/items/{itemId}/barcode")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public InventoryDtos.BarcodeResponse barcodeForItem(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.generateBarcode(hotelId, hotelHeader, itemId);
    }

    @PostMapping("/warehouses")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.WarehouseItem createWarehouse(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.WarehouseCreateRequest body) {
        return invExtService.createWarehouse(hotelId, hotelHeader, body);
    }

    @GetMapping("/warehouses")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public List<InventoryDtos.WarehouseItem> listWarehouses(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        inventoryDepotService.syncWarehousesFromDepots(hotelId, hotelHeader);
        return invExtService.listWarehouses(hotelId, hotelHeader);
    }

    @PostMapping("/customers")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.CustomerItem createCustomer(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.CustomerCreateRequest body) {
        return invExtService.createCustomer(hotelId, hotelHeader, body);
    }

    @GetMapping("/customers")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public List<InventoryDtos.CustomerItem> listCustomers(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listCustomers(hotelId, hotelHeader);
    }

    @PostMapping("/sales-invoices")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public ResponseEntity<InventoryDtos.SalesInvoiceItem> createSalesInvoice(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.SalesInvoiceCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invExtService.createSalesInvoice(hotelId, hotelHeader, body));
    }

    @PostMapping("/sales-invoices/{invoiceId}/issue")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDtos.SalesInvoiceItem issueSalesInvoice(
            @PathVariable UUID hotelId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.issueInvoice(hotelId, hotelHeader, invoiceId);
    }

    @PostMapping("/sales-invoices/{invoiceId}/payments")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDtos.SalesInvoiceItem recordInvoicePayment(
            @PathVariable UUID hotelId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.SalesPaymentRequest body) {
        return invExtService.recordPayment(hotelId, hotelHeader, invoiceId, body);
    }

    @PostMapping("/sales-invoices/{invoiceId}/return-full")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.SalesInvoiceItem returnSalesInvoiceFull(
            @PathVariable UUID hotelId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.returnSalesInvoiceFull(hotelId, hotelHeader, invoiceId);
    }

    @GetMapping("/sales-invoices")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public List<InventoryDtos.SalesInvoiceSummary> listSalesInvoices(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listSalesInvoices(hotelId, hotelHeader);
    }

    @GetMapping("/sales-invoices/{invoiceId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER','ROLE_RECEPTIONIST')")
    public InventoryDtos.SalesInvoiceItem getSalesInvoice(
            @PathVariable UUID hotelId,
            @PathVariable UUID invoiceId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.getSalesInvoice(hotelId, hotelHeader, invoiceId);
    }

    @PostMapping("/stock-transfers")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<InventoryDtos.TransferItem> createStockTransfer(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.TransferCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invExtService.createTransfer(hotelId, hotelHeader, body));
    }

    @PostMapping("/stock-transfers/{transferId}/complete")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public InventoryDtos.TransferItem completeStockTransfer(
            @PathVariable UUID hotelId,
            @PathVariable UUID transferId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.completeTransfer(hotelId, hotelHeader, transferId);
    }

    @GetMapping("/stock-transfers")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public List<InventoryDtos.TransferItem> listStockTransfers(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listTransfers(hotelId, hotelHeader);
    }

    @GetMapping("/dashboard")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public InventoryDtos.InvDashboardResponse inventoryDashboard(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.getDashboard(hotelId, hotelHeader);
    }

    @GetMapping("/reports/sales")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public InventoryDtos.SalesReport salesReport(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return invExtService.getSalesReport(hotelId, hotelHeader, from, to);
    }

    @GetMapping("/reports/purchases")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public InventoryDtos.PurchaseReport purchaseReport(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return invExtService.getPurchaseReport(hotelId, hotelHeader, from, to);
    }

    @GetMapping("/reports/stock-value")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public InventoryDtos.StockValueReport stockValueReport(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.getStockValueReport(hotelId, hotelHeader);
    }

    @GetMapping("/reports/profit")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public InventoryDtos.ProfitReport profitReport(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return invExtService.getProfitReport(hotelId, hotelHeader, from, to);
    }

    @GetMapping("/reports/expired-products")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public List<InventoryDtos.ExpiredProductLine> expiredProductsReport(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listExpiredProducts(hotelId, hotelHeader);
    }

    @GetMapping("/reports/user-activity")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public List<InventoryDtos.UserActivityLine> userActivityReport(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return invExtService.listUserActivity(hotelId, hotelHeader);
    }

    @GetMapping("/settings/valuation")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_WAITER','ROLE_CASHIER')")
    public java.util.Map<String, String> valuationSettings(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        inventoryDepotService.syncWarehousesFromDepots(hotelId, hotelHeader);
        invExtService.listWarehouses(hotelId, hotelHeader);
        return java.util.Map.of(
                "defaultMethod",
                "AVERAGE_COST",
                "supported",
                "FIFO,AVERAGE_COST",
                "note",
                "Per-product valuation is stored on each inventory item.");
    }
}
