package com.hms.api;

import com.hms.api.dto.ApiDtos;
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
public class HotelFeePolicyController {

    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;

    public HotelFeePolicyController(HotelRepository hotelRepository, TenantAccessService tenantAccessService) {
        this.hotelRepository = hotelRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @GetMapping("/fee-policy")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_FINANCE')")
    public ApiDtos.HotelFeePolicy feePolicy(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel h = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        return new ApiDtos.HotelFeePolicy(
                h.getEarlyCheckinFee() != null ? h.getEarlyCheckinFee() : BigDecimal.ZERO,
                h.getLateCheckoutFee() != null ? h.getLateCheckoutFee() : BigDecimal.ZERO,
                h.getNoShowDefaultFee() != null ? h.getNoShowDefaultFee() : BigDecimal.ZERO,
                h.getCurrency(),
                toOverstayPolicy(h));
    }

    @PutMapping("/fee-policy")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ApiDtos.HotelFeePolicy updateFeePolicy(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody ApiDtos.HotelFeePolicy body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel h = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        if (body.earlyCheckinFee() != null) h.setEarlyCheckinFee(nonNegative(body.earlyCheckinFee()));
        if (body.lateCheckoutFee() != null) h.setLateCheckoutFee(nonNegative(body.lateCheckoutFee()));
        if (body.noShowDefaultFee() != null) h.setNoShowDefaultFee(nonNegative(body.noShowDefaultFee()));
        if (body.overstayPolicy() != null) {
            ApiDtos.OverstayPolicy p = body.overstayPolicy();
            if (p.autoPostEnabled() != null) h.setOverstayAutoPostEnabled(p.autoPostEnabled());
            if (p.graceMinutes() != null) h.setOverstayGraceMinutes(Math.max(0, p.graceMinutes()));
            if (p.hourlyPercent() != null) h.setOverstayHourlyPercent(nonNegative(p.hourlyPercent()));
            if (p.halfDayCapPercent() != null) h.setOverstayHalfDayCapPercent(nonNegative(p.halfDayCapPercent()));
            if (p.fullDayAfterHours() != null) h.setOverstayFullDayAfterHours(Math.max(1, p.fullDayAfterHours()));
            if (p.maxDailyPercent() != null) h.setOverstayMaxDailyPercent(nonNegative(p.maxDailyPercent()));
            if (p.applyTax() != null) h.setOverstayApplyTax(p.applyTax());
            if (p.postTiming() != null && !p.postTiming().isBlank()) {
                String timing = p.postTiming().trim().toUpperCase();
                if (!"AT_CHECKOUT".equals(timing) && !"SCHEDULED_AUTO".equals(timing)) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid overstay post timing");
                }
                h.setOverstayPostTiming(timing);
            }
        }
        h = hotelRepository.save(h);
        return new ApiDtos.HotelFeePolicy(
                h.getEarlyCheckinFee() != null ? h.getEarlyCheckinFee() : BigDecimal.ZERO,
                h.getLateCheckoutFee() != null ? h.getLateCheckoutFee() : BigDecimal.ZERO,
                h.getNoShowDefaultFee() != null ? h.getNoShowDefaultFee() : BigDecimal.ZERO,
                h.getCurrency(),
                toOverstayPolicy(h));
    }

    private static ApiDtos.OverstayPolicy toOverstayPolicy(Hotel h) {
        return new ApiDtos.OverstayPolicy(
                h.isOverstayAutoPostEnabled(),
                h.getOverstayGraceMinutes(),
                h.getOverstayHourlyPercent(),
                h.getOverstayHalfDayCapPercent(),
                h.getOverstayFullDayAfterHours(),
                h.getOverstayMaxDailyPercent(),
                h.isOverstayApplyTax(),
                h.getOverstayPostTiming());
    }

    private static BigDecimal nonNegative(BigDecimal value) {
        return value != null && value.signum() > 0 ? value : BigDecimal.ZERO;
    }
}
