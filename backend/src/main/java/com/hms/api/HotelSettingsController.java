package com.hms.api;

import com.hms.entity.Hotel;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
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

    public HotelSettingsController(HotelRepository hotelRepository, TenantAccessService tenantAccessService) {
        this.hotelRepository = hotelRepository;
        this.tenantAccessService = tenantAccessService;
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

    @PutMapping("/settings")
    @PreAuthorize("hasAnyAuthority('ROLE_HOTEL_ADMIN','ROLE_SUPER_ADMIN')")
    public HotelContextResponse updateSettings(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody UpdateHotelSettingsRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel h = mustHotel(hotelId);
        h.setName(trimOrNull(body.name()));
        h.setCompanyName(trimOrNull(body.companyName()));
        h.setLogoUrl(trimOrNull(body.logoUrl()));
        h.setPhone(trimOrNull(body.phone()));
        h.setEmail(trimOrNull(body.email()));
        h.setAddress(trimOrNull(body.address()));
        h.setTinNumber(trimOrNull(body.tinNumber()));
        h.setDefaultCountry(trimOrNull(body.defaultCountry()));
        h.setDefaultIdType(trimOrNull(body.defaultIdType()));
        h.setPhoneCountryCode(trimOrNull(body.phoneCountryCode()));
        h.setInvoicePrefix(trimOrNull(body.invoicePrefix()));
        h.setTimezone(trimOrNull(body.timezone()));
        h.setCurrency(trimOrNull(body.currency()));
        h.setCheckInTime(trimOrNull(body.checkInTime()));
        h.setCheckOutTime(trimOrNull(body.checkOutTime()));
        h.setTaxRate(body.taxRate());
        return toResponse(hotelRepository.save(h));
    }

    private Hotel mustHotel(UUID hotelId) {
        return hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String out = value.trim();
        return out.isEmpty() ? null : out;
    }

    private static HotelContextResponse toResponse(Hotel h) {
        return new HotelContextResponse(
                h.getId(),
                h.getName(),
                h.getCompanyName(),
                h.getLogoUrl(),
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
                h.isOverstayAutoPostEnabled(),
                h.getOverstayGraceMinutes(),
                h.getOverstayHourlyPercent(),
                h.getOverstayHalfDayCapPercent(),
                h.getOverstayFullDayAfterHours(),
                h.getOverstayMaxDailyPercent(),
                h.isOverstayApplyTax(),
                h.getOverstayPostTiming());
    }

    public record HotelContextResponse(
            UUID id,
            String name,
            String companyName,
            String logoUrl,
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
            Boolean overstayAutoPostEnabled,
            Integer overstayGraceMinutes,
            BigDecimal overstayHourlyPercent,
            BigDecimal overstayHalfDayCapPercent,
            Integer overstayFullDayAfterHours,
            BigDecimal overstayMaxDailyPercent,
            Boolean overstayApplyTax,
            String overstayPostTiming) {}

    public record UpdateHotelSettingsRequest(
            String name,
            String companyName,
            String logoUrl,
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
            BigDecimal taxRate) {}
}

