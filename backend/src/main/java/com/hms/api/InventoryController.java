package com.hms.api;

import com.hms.api.dto.InventoryDtos;
import com.hms.api.dto.InventoryDepotDtos;
import com.hms.service.InventoryDepotService;
import com.hms.service.InventoryService;
import jakarta.validation.Valid;
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
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryDepotService inventoryDepotService;

    public InventoryController(InventoryService inventoryService, InventoryDepotService inventoryDepotService) {
        this.inventoryService = inventoryService;
        this.inventoryDepotService = inventoryDepotService;
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
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_HOUSEKEEPING')")
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
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_HOUSEKEEPING')")
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
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_HOUSEKEEPING')")
    public InventoryDtos.InventoryItemsResponse listItems(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean lowStock,
            @RequestParam(required = false) String search) {
        return inventoryService.listItems(hotelId, hotelHeader, category, lowStock, search);
    }

    @PostMapping("/items/{itemId}/consume")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FNB_STAFF','ROLE_HOUSEKEEPING','ROLE_RECEPTIONIST')")
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
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF')")
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
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
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
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF')")
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
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public ResponseEntity<InventoryDepotDtos.CreateSaleResponse> createSale(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDepotDtos.CreateSaleRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryDepotService.createSale(hotelId, hotelHeader, body));
    }

    @GetMapping("/sales")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public java.util.List<InventoryDepotDtos.SaleRow> listSales(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID depotId) {
        return inventoryDepotService.listSales(hotelId, hotelHeader, depotId);
    }

    @GetMapping("/sales/{saleId}")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.SaleDetailResponse getSale(
            @PathVariable UUID hotelId,
            @PathVariable UUID saleId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.getSaleDetail(hotelId, hotelHeader, saleId);
    }

    /** Same as {@link #getSale} but query param — avoids some proxies/path issues with UUID in the last path segment. */
    @GetMapping("/sales/detail")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_FNB_STAFF','ROLE_RECEPTIONIST')")
    public InventoryDepotDtos.SaleDetailResponse getSaleDetailQuery(
            @PathVariable UUID hotelId,
            @RequestParam("saleId") UUID saleId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return inventoryDepotService.getSaleDetail(hotelId, hotelHeader, saleId);
    }
}
