package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.CorporateAccount;
import com.hms.entity.Hotel;
import com.hms.repository.CorporateAccountRepository;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CorporateAccountService {

    private final CorporateAccountRepository corporateAccountRepository;
    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;

    @Transactional(readOnly = true)
    public List<ApiDtos.CorporateAccountRow> list(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return corporateAccountRepository.findByHotel_IdOrderByCompanyNameAsc(hotelId).stream()
                .map(this::toRow)
                .toList();
    }

    @Transactional
    public ApiDtos.CorporateAccountRow create(UUID hotelId, String hotelHeader, ApiDtos.CorporateAccountCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        CorporateAccount a = new CorporateAccount();
        a.setHotel(hotel);
        a.setCompanyName(req.companyName().trim());
        a.setBillingEmail(req.billingEmail() != null ? req.billingEmail().trim() : null);
        a.setCreditLimit(req.creditLimit());
        a.setPaymentTerms(req.paymentTerms() != null ? req.paymentTerms().trim() : null);
        a.setStatus(req.status() != null && !req.status().isBlank() ? req.status().trim().toUpperCase() : "ACTIVE");
        a = corporateAccountRepository.save(a);
        return toRow(a);
    }

    private ApiDtos.CorporateAccountRow toRow(CorporateAccount a) {
        return new ApiDtos.CorporateAccountRow(
                a.getId(),
                a.getCompanyName(),
                a.getBillingEmail(),
                a.getCreditLimit(),
                a.getPaymentTerms(),
                a.getStatus(),
                a.getCreatedAt());
    }
}
