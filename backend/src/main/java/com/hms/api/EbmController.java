package com.hms.api;

import com.hms.api.dto.EbmDtos;
import com.hms.config.HmsEbmProperties;
import com.hms.entity.InventoryItem;
import com.hms.repository.EbmCodeListRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.security.TenantAccessService;
import com.hms.service.EbmDeviceService;
import com.hms.service.EbmItemCdService;
import com.hms.service.EbmSaleEventService;
import com.hms.web.ApiException;
import java.util.List;
import java.util.Map;
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
    private final EbmSaleEventService saleEventService;
    private final InventoryItemRepository inventoryItemRepository;
    private final EbmCodeListRepository codeListRepository;
    private final TenantAccessService tenantAccessService;
    private final HmsEbmProperties properties;

    public EbmController(
            EbmDeviceService deviceService,
            EbmItemCdService itemCdService,
            EbmSaleEventService saleEventService,
            InventoryItemRepository inventoryItemRepository,
            EbmCodeListRepository codeListRepository,
            TenantAccessService tenantAccessService,
            HmsEbmProperties properties) {
        this.deviceService = deviceService;
        this.itemCdService = itemCdService;
        this.saleEventService = saleEventService;
        this.inventoryItemRepository = inventoryItemRepository;
        this.codeListRepository = codeListRepository;
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

    @PostMapping("/outbox/{outboxId}/retry")
    public EbmDtos.OutboxRow retryOutbox(
            @PathVariable UUID hotelId,
            @PathVariable UUID outboxId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return deviceService.retryOutbox(hotelId, hotelHeader, outboxId);
    }

    @PostMapping("/outbox/retry-failed")
    public Map<String, Object> retryFailed(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        int n = deviceService.retryAllFailed(hotelId, hotelHeader);
        return Map.of("retried", n);
    }

    @GetMapping("/sale-events")
    public List<EbmDtos.SaleEventRow> saleEvents(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "50") int limit) {
        return deviceService.listSaleEvents(hotelId, hotelHeader, limit);
    }

    @GetMapping("/sale-events/by-source")
    public EbmDtos.SaleEventRow saleEventBySource(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam String sourceType,
            @RequestParam UUID sourceId) {
        return deviceService.findSaleEventBySource(hotelId, hotelHeader, sourceType, sourceId);
    }

    @GetMapping("/code-lists")
    public List<EbmDtos.CodeListRow> codeLists(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String category) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        var rows = category == null || category.isBlank()
                ? codeListRepository.findByHotel_IdOrderByCategoryAscCodeAsc(hotelId)
                : codeListRepository.findByHotel_IdAndCategoryOrderByCodeAsc(hotelId, category.trim().toUpperCase());
        return rows.stream()
                .map(e -> new EbmDtos.CodeListRow(
                        e.getId(), e.getCategory(), e.getCode(), e.getName(), e.getParentCode(), e.getSyncedAt()))
                .toList();
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
        if (Boolean.TRUE.equals(body.saveToVsdc())) {
            try {
                saleEventService.enqueueItemSave(hotelId, item);
            } catch (Exception ignored) {
                // never block classify
            }
        }
        return new EbmDtos.ItemCdView(
                item.getId(),
                item.getItemCd(),
                item.getItemTyCd(),
                item.getPkgUnitCd(),
                item.getQtyUnitCd(),
                item.getItemClsCd());
    }

    @PostMapping("/inventory-items/{itemId}/save-to-vsdc")
    public Map<String, Object> saveItemToVsdc(
            @PathVariable UUID hotelId,
            @PathVariable UUID itemId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        InventoryItem item = inventoryItemRepository
                .findByIdAndHotel_Id(itemId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Item not found"));
        saleEventService.enqueueItemSave(hotelId, item);
        return Map.of("enqueued", true, "itemCd", item.getItemCd() != null ? item.getItemCd() : "");
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
