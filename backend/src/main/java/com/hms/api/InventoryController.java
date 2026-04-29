package com.hms.api;

import com.hms.api.dto.InventoryDtos;
import com.hms.service.InventoryService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
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

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
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

    @PostMapping("/categories")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ResponseEntity<InventoryDtos.CreatedIdResponse> createCategory(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody InventoryDtos.CategoryCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(inventoryService.createCategory(hotelId, hotelHeader, body));
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
}
