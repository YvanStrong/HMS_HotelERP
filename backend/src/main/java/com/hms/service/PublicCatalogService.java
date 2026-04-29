package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.SubscriptionStatus;
import com.hms.entity.Hotel;
import com.hms.entity.Room;
import com.hms.entity.RoomType;
import com.hms.repository.HotelRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicCatalogService {

    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;

    public PublicCatalogService(
            HotelRepository hotelRepository, RoomTypeRepository roomTypeRepository, RoomRepository roomRepository) {
        this.hotelRepository = hotelRepository;
        this.roomTypeRepository = roomTypeRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.PublicHotelCatalogItem> listHotels() {
        return hotelRepository.findAll(Sort.by(Sort.Order.asc("name"))).stream()
                .map(PublicCatalogService::toPublicHotel)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.PublicRoomTypeCatalogItem> listRoomTypes(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
        return roomTypeRepository.findByHotel_Id(hotelId).stream()
                .sorted(java.util.Comparator.comparing(RoomType::getName))
                .map(PublicCatalogService::toPublicRoomType)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.PublicRoomOffer> listRoomOffers(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
        List<Room> rooms = roomRepository.findByHotel_Id(hotelId);
        List<ApiDtos.PublicRoomOffer> out = new ArrayList<>();
        for (Room r : rooms) {
            if (!RoomBookingEligibility.isVacantBookable(r)) {
                continue;
            }
            RoomType rt = r.getRoomType();
            Set<String> features = new LinkedHashSet<>();
            if (rt.getAmenities() != null) {
                features.addAll(rt.getAmenities());
            }
            if (r.getAmenitiesOverride() != null && !r.getAmenitiesOverride().isBlank()) {
                for (String part : r.getAmenitiesOverride().split(",")) {
                    String t = part.trim();
                    if (!t.isEmpty()) {
                        features.add(t);
                    }
                }
            }
            if (r.isHasMinibar()) {
                features.add("Minibar");
            }
            BigDecimal from = rt.getBaseRate();
            out.add(new ApiDtos.PublicRoomOffer(
                    r.getId(),
                    r.getRoomNumber(),
                    r.getFloor(),
                    rt.getId(),
                    rt.getName(),
                    from,
                    List.copyOf(features)));
        }
        out.sort(java.util.Comparator.comparing(ApiDtos.PublicRoomOffer::roomNumber));
        return out;
    }

    private static ApiDtos.PublicRoomTypeCatalogItem toPublicRoomType(RoomType rt) {
        List<String> am = rt.getAmenities() != null ? List.copyOf(rt.getAmenities()) : List.of();
        String desc = rt.getDescription() != null ? rt.getDescription() : "";
        return new ApiDtos.PublicRoomTypeCatalogItem(
                rt.getId(),
                rt.getCode(),
                rt.getName(),
                desc,
                rt.getBaseRate(),
                rt.getMaxOccupancy(),
                rt.getBedCount(),
                am);
    }

    private static ApiDtos.PublicHotelCatalogItem toPublicHotel(Hotel h) {
        boolean active = h.getSubscriptionStatus() != SubscriptionStatus.SUSPENDED;
        return new ApiDtos.PublicHotelCatalogItem(
                h.getId(),
                h.getName(),
                h.getCode(),
                h.getCurrency(),
                h.getTimezone(),
                h.getDescription(),
                h.getAddress(),
                h.getPhone(),
                h.getEmail(),
                h.getImageUrl(),
                h.getLogoUrl(),
                h.getStarRating(),
                active);
    }
}
