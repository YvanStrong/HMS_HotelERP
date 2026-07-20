package com.hms.api;

import com.hms.api.dto.EbmDtos;
import com.hms.config.HmsEbmProperties;
import com.hms.entity.InventoryItem;
import com.hms.repository.InventoryItemRepository;
import com.hms.security.TenantAccessService;
import com.hms.service.EbmDeviceService;
import com.hms.service.EbmItemCdService;
import com.hms.web.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/ebm")
@PreAuthorize("hasAnyAuthority('ROLE_HOTEL_ADMIN','ROLE_GENERAL_MANAGER','ROLE_SUPER_ADMIN')")
public class EbmController {

    private final EbmDeviceService deviceService;
    private final EbmItemCdService itemCdService;
    private final InventoryItemRepository inventoryItemRepository;
    private final TenantAccessService tenantAccessService;
    private final HmsEbmProperties properties;

    public EbmController(
            EbmDeviceService deviceService,
            EbmItemCdService itemCdService,
            InventoryItemRepository inventoryItemRepository,
            TenantAccessService tenantAccessService,
            HmsEbmProperties properties) {
        this.deviceService = deviceService;
        this.itemCdService = itemCdService;
        this.inventoryItemRepository = inventoryItemRepository;
        this.tenantAccessService = tenantAccessService;
        this.properties = properties;
    }

    @GetMapping("/status")
    public EbmDtos.StatusResponse status(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return deviceService.status(hotelId, hotelHeader);
    }

    @PostMapping("/devices")
    public EbmDtos.DeviceView registerDevice(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody EbmDtos.RegisterDeviceRequest body) {
        return deviceService.registerOrUpdate(hotelId, hotelHeader, body);
    }

    @PostMapping("/devices/{deviceId}/initialize")
    public EbmDtos.DeviceView initialize(
            @PathVariable UUID hotelId,
            @PathVariable UUID deviceId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return deviceService.initialize(hotelId, hotelHeader, deviceId);
    }

    @PostMapping("/devices/{deviceId}/disable")
    public EbmDtos.DeviceView disable(
            @PathVariable UUID hotelId,
            @PathVariable UUID deviceId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return deviceService.disable(hotelId, hotelHeader, deviceId);
    }

    @GetMapping("/outbox")
    public List<EbmDtos.OutboxRow> outbox(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "50") int limit) {
        return deviceService.listOutbox(hotelId, hotelHeader, limit);
    }

    @GetMapping("/sale-events")
    public List<EbmDtos.SaleEventRow> saleEvents(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "50") int limit) {
        return deviceService.listSaleEvents(hotelId, hotelHeader, limit);
    }

    @PutMapping("/inventory-items/{itemId}/classify")
    public EbmDtos.ItemCdView classifyItem(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody EbmDtos.ClassifyItemRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem item = inventoryItemRepository
                .findByIdAndHotel_Id(itemId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Item not found"));
        if (body.itemTyCd() != null && !body.itemTyCd().isBlank()) {
            item.setItemTyCd(body.itemTyCd().trim());
        }
        if (body.pkgUnitCd() != null && !body.pkgUnitCd().isBlank()) {
            item.setPkgUnitCd(body.pkgUnitCd().trim().toUpperCase());
        }
        if (body.qtyUnitCd() != null && !body.qtyUnitCd().isBlank()) {
            item.setQtyUnitCd(body.qtyUnitCd().trim().toUpperCase());
        }
        if (body.itemClsCd() != null && !body.itemClsCd().isBlank()) {
            item.setItemClsCd(body.itemClsCd().trim());
        }
        boolean regenerate = body.regenerateItemCd();
        if (regenerate || item.getItemCd() == null || item.getItemCd().isBlank()) {
            item.setItemCd(null);
            itemCdService.ensureItemCd(item);
        }
        inventoryItemRepository.save(item);
        return new EbmDtos.ItemCdView(
                item.getId(),
                item.getItemCd(),
                item.getItemTyCd(),
                item.getPkgUnitCd(),
                item.getQtyUnitCd(),
                item.getItemClsCd());
    }

    @GetMapping("/config")
    public ConfigView config(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return new ConfigView(
                properties.isEnabled(),
                properties.getCountryCode(),
                properties.getDefaultItemTyCd(),
                properties.getDefaultPkgUnitCd(),
                properties.getDefaultQtyUnitCd(),
                properties.getOfflineWarnHours(),
                properties.getOfflineAlertHours());
    }

    public record ConfigView(
            boolean enabled,
            String countryCode,
            String defaultItemTyCd,
            String defaultPkgUnitCd,
            String defaultQtyUnitCd,
            int offlineWarnHours,
            int offlineAlertHours) {}
}
