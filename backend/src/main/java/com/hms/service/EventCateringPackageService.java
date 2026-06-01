package com.hms.service;

import com.hms.api.dto.EventOpsDtos;
import com.hms.domain.EventCateringPackageType;
import com.hms.entity.EventCateringPackage;
import com.hms.entity.Hotel;
import com.hms.repository.EventCateringPackageRepository;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EventCateringPackageService {

    private final EventCateringPackageRepository packageRepository;
    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;

    @Transactional(readOnly = true)
    public List<EventOpsDtos.CateringPackageResponse> list(UUID hotelId, String hotelHeader, boolean activeOnly) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        var rows = activeOnly
                ? packageRepository.findByHotel_IdAndActiveTrueOrderByPackageNameAsc(hotelId)
                : packageRepository.findByHotel_IdOrderByPackageNameAsc(hotelId);
        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional
    public EventOpsDtos.CateringPackageResponse create(
            UUID hotelId, String hotelHeader, EventOpsDtos.CateringPackageRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        EventCateringPackage pkg = new EventCateringPackage();
        pkg.setHotel(hotel);
        apply(pkg, req);
        return toResponse(packageRepository.save(pkg));
    }

    @Transactional
    public EventOpsDtos.CateringPackageResponse update(
            UUID hotelId, String hotelHeader, UUID packageId, EventOpsDtos.CateringPackageRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        EventCateringPackage pkg = packageRepository
                .findByIdAndHotel_Id(packageId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Catering package not found"));
        apply(pkg, req);
        return toResponse(packageRepository.save(pkg));
    }

    private void apply(EventCateringPackage pkg, EventOpsDtos.CateringPackageRequest req) {
        pkg.setPackageName(req.packageName().trim());
        pkg.setDescription(blank(req.description()));
        pkg.setPackageType(req.packageType() != null ? req.packageType() : EventCateringPackageType.CUSTOM);
        pkg.setPricePerPax(req.pricePerPax().setScale(2, RoundingMode.HALF_UP));
        if (req.taxable() != null) pkg.setTaxable(req.taxable());
        if (req.active() != null) pkg.setActive(req.active());
    }

    private String blank(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private EventOpsDtos.CateringPackageResponse toResponse(EventCateringPackage pkg) {
        return new EventOpsDtos.CateringPackageResponse(
                pkg.getId(),
                pkg.getPackageName(),
                pkg.getDescription(),
                pkg.getPackageType(),
                pkg.getPricePerPax(),
                pkg.isTaxable(),
                pkg.isActive());
    }
}
