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
        return toDto(h);
    }

    @PutMapping("/fee-policy")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')")
    public ApiDtos.HotelFeePolicy updateFeePolicy(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody ApiDtos.HotelFeePolicyUpdateRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel h = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        if (body.earlyCheckinFee() != null) h.setEarlyCheckinFee(nonNegativeMoney(body.earlyCheckinFee()));
        if (body.lateCheckoutFee() != null) h.setLateCheckoutFee(nonNegativeMoney(body.lateCheckoutFee()));
        if (body.noShowDefaultFee() != null) h.setNoShowDefaultFee(nonNegativeMoney(body.noShowDefaultFee()));
        if (body.overstayAutoPostEnabled() != null) h.setOverstayAutoPostEnabled(body.overstayAutoPostEnabled());
        if (body.overstayGraceMinutes() != null) h.setOverstayGraceMinutes(Math.max(0, body.overstayGraceMinutes()));
        if (body.overstayHourlyPercent() != null) h.setOverstayHourlyPercent(nonNegativePercent(body.overstayHourlyPercent()));
        if (body.overstayHalfDayCapPercent() != null)
            h.setOverstayHalfDayCapPercent(nonNegativePercent(body.overstayHalfDayCapPercent()));
        if (body.overstayFullNightAfterHours() != null)
            h.setOverstayFullDayAfterHours(Math.max(1, body.overstayFullNightAfterHours()));
        if (body.overstayMaxDailyPercent() != null) h.setOverstayMaxDailyPercent(nonNegativePercent(body.overstayMaxDailyPercent()));
        if (body.overstayApplyTax() != null) h.setOverstayApplyTax(body.overstayApplyTax());
        if (body.overstayPostTiming() != null) {
            String timing = body.overstayPostTiming().trim().toUpperCase();
            if (!"AT_CHECKOUT".equals(timing) && !"SCHEDULED_AUTO".equals(timing)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid overstay posting behavior");
            }
            h.setOverstayPostTiming(timing);
        }
        return toDto(hotelRepository.save(h));
    }

    private static ApiDtos.HotelFeePolicy toDto(Hotel h) {
        return new ApiDtos.HotelFeePolicy(
                h.getEarlyCheckinFee() != null ? h.getEarlyCheckinFee() : BigDecimal.ZERO,
                h.getLateCheckoutFee() != null ? h.getLateCheckoutFee() : BigDecimal.ZERO,
                h.getNoShowDefaultFee() != null ? h.getNoShowDefaultFee() : BigDecimal.ZERO,
                h.getCurrency(),
                h.isOverstayAutoPostEnabled(),
                h.getOverstayGraceMinutes(),
                h.getOverstayHourlyPercent(),
                h.getOverstayHalfDayCapPercent(),
                h.getOverstayFullDayAfterHours(),
                h.getOverstayMaxDailyPercent(),
                h.isOverstayApplyTax(),
                h.getOverstayPostTiming());
    }

    private static BigDecimal nonNegativeMoney(BigDecimal amount) {
        return amount.max(BigDecimal.ZERO).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static BigDecimal nonNegativePercent(BigDecimal amount) {
        return amount.max(BigDecimal.ZERO).setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
