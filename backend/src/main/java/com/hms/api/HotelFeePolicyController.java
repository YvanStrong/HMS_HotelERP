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
                h.getCurrency());
    }
}
