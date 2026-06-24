package com.hms.api;

import com.hms.entity.Hotel;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.service.HotelModuleEntitlementService;
import com.hms.service.PlatformTenantService;
import com.hms.service.PosSettingsService;
import com.hms.api.dto.PlatformDtos;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}")
public class HotelSettingsController {

    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;
    private final HotelModuleEntitlementService hotelModuleEntitlementService;
    private final PlatformTenantService platformTenantService;
    private final PosSettingsService posSettingsService;

    public HotelSettingsController(
            HotelRepository hotelRepository,
            TenantAccessService tenantAccessService,
            HotelModuleEntitlementService hotelModuleEntitlementService,
            PlatformTenantService platformTenantService,
            PosSettingsService posSettingsService) {
        this.hotelRepository = hotelRepository;
        this.tenantAccessService = tenantAccessService;
        this.hotelModuleEntitlementService = hotelModuleEntitlementService;
        this.platformTenantService = platformTenantService;
        this.posSettingsService = posSettingsService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public HotelContextResponse hotelContext(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel h = mustHotel(hotelId);
        return toResponse(h);
    }

    @GetMapping("/settings")
    @PreAuthorize("hasAnyAuthority('ROLE_HOTEL_ADMIN','ROLE_GENERAL_MANAGER','ROLE_SUPER_ADMIN')")
    public HotelContextResponse getSettings(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return toResponse(mustHotel(hotelId));
    }

    @GetMapping("/module-entitlements")
    @PreAuthorize("isAuthenticated()")
    public PlatformDtos.ModuleEntitlementsContextResponse moduleEntitlements(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return new PlatformDtos.ModuleEntitlementsContextResponse(
                hotelModuleEntitlementService.resolveEnabledModules(hotelId).stream().sorted().toList(),
                hotelModuleEntitlementService.resolveVisibleDisabledModules(hotelId).stream().sorted().toList());
    }

    @GetMapping("/subscription-status")
    @PreAuthorize("isAuthenticated()")
    public PlatformDtos.TenantSubscriptionStatusResponse subscriptionStatus(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return platformTenantService.subscriptionStatus(hotelId);
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAnyAuthority('ROLE_HOTEL_ADMIN','ROLE_SUPER_ADMIN')")
    public HotelContextResponse updateSettings(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody UpdateHotelSettingsRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel h = mustHotel(hotelId);
        if (body.name() != null && trimOrNull(body.name()) != null) h.setName(trimOrNull(body.name()));
        if (body.companyName() != null) h.setCompanyName(trimOrNull(body.companyName()));
        if (body.logoUrl() != null) h.setLogoUrl(trimOrNull(body.logoUrl()));
        if (body.imageUrl() != null) h.setImageUrl(trimOrNull(body.imageUrl()));
        if (body.phone() != null) h.setPhone(trimOrNull(body.phone()));
        if (body.email() != null) h.setEmail(trimOrNull(body.email()));
        if (body.address() != null) h.setAddress(trimOrNull(body.address()));
        if (body.tinNumber() != null) h.setTinNumber(trimOrNull(body.tinNumber()));
        if (body.defaultCountry() != null) h.setDefaultCountry(trimOrNull(body.defaultCountry()));
        if (body.defaultIdType() != null) h.setDefaultIdType(trimOrNull(body.defaultIdType()));
        if (body.phoneCountryCode() != null) h.setPhoneCountryCode(trimOrNull(body.phoneCountryCode()));
        if (body.invoicePrefix() != null) h.setInvoicePrefix(trimOrNull(body.invoicePrefix()));
        if (body.timezone() != null) h.setTimezone(trimOrNull(body.timezone()));
        if (body.currency() != null) h.setCurrency(trimOrNull(body.currency()));
        if (body.checkInTime() != null) h.setCheckInTime(trimOrNull(body.checkInTime()));
        if (body.checkOutTime() != null) h.setCheckOutTime(trimOrNull(body.checkOutTime()));
        if (body.taxRate() != null) h.setTaxRate(body.taxRate());
        if (body.posRequireShift() != null) h.setPosRequireShift(body.posRequireShift());
        if (body.posLowStockThreshold() != null) h.setPosLowStockThreshold(body.posLowStockThreshold());
        hotelRepository.save(h);
        return toResponse(mustHotel(hotelId));
    }

    private Hotel mustHotel(UUID hotelId) {
        return hotelRepository
                .findByIdWithBusinessCategory(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String out = value.trim();
        return out.isEmpty() ? null : out;
    }

    private HotelContextResponse toResponse(Hotel h) {
        return new HotelContextResponse(
                h.getId(),
                h.getName(),
                h.getCompanyName(),
                h.getLogoUrl(),
                h.getImageUrl(),
                h.getCurrency(),
                h.getDefaultCountry(),
                h.getPhone(),
                h.getEmail(),
                h.getAddress(),
                h.getTinNumber(),
                h.getTimezone(),
                h.getCheckInTime(),
                h.getCheckOutTime(),
                h.getInvoicePrefix(),
                h.getDefaultIdType(),
                h.getPhoneCountryCode(),
                h.getTaxRate(),
                h.getBusinessCategory() != null ? h.getBusinessCategory().getId() : null,
                h.getBusinessCategory() != null ? h.getBusinessCategory().getCode() : null,
                posSettingsService.resolveRequireShift(h),
                posSettingsService.resolveLowStockThreshold(h));
    }

    public record HotelContextResponse(
            UUID id,
            String name,
            String companyName,
            String logoUrl,
            String imageUrl,
            String currency,
            String defaultCountry,
            String phone,
            String email,
            String address,
            String tinNumber,
            String timezone,
            String checkInTime,
            String checkOutTime,
            String invoicePrefix,
            String defaultIdType,
            String phoneCountryCode,
            BigDecimal taxRate,
            UUID businessCategoryId,
            String businessCategoryCode,
            boolean posRequireShift,
            int posLowStockThreshold) {}

    public record UpdateHotelSettingsRequest(
            String name,
            String companyName,
            String logoUrl,
            String imageUrl,
            String phone,
            String email,
            String address,
            String tinNumber,
            String defaultCountry,
            String defaultIdType,
            String phoneCountryCode,
            String invoicePrefix,
            String timezone,
            String currency,
            String checkInTime,
            String checkOutTime,
            BigDecimal taxRate,
            Boolean posRequireShift,
            Integer posLowStockThreshold) {}
}

