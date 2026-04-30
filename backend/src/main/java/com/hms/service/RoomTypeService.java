package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.Hotel;
import com.hms.entity.RoomType;
import com.hms.repository.HotelRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomTypeService {

    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;
    private final TenantAccessService tenantAccessService;

    public RoomTypeService(
            HotelRepository hotelRepository,
            RoomTypeRepository roomTypeRepository,
            RoomRepository roomRepository,
            TenantAccessService tenantAccessService) {
        this.hotelRepository = hotelRepository;
        this.roomTypeRepository = roomTypeRepository;
        this.roomRepository = roomRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional(readOnly = true)
    public java.util.List<RoomType> list(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        return roomTypeRepository.findByHotel_Id(hotelId);
    }

    @Transactional
    public ApiDtos.CreateRoomTypeResponse create(UUID hotelId, String hotelHeader, ApiDtos.RoomTypeCreateInput in) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        return persistRoomType(hotel, in);
    }

    @Transactional(readOnly = true)
    public RoomType get(UUID hotelId, String hotelHeader, UUID roomTypeId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        return roomTypeRepository
                .findByIdAndHotel_Id(roomTypeId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room type not found"));
    }

    @Transactional
    public ApiDtos.CreateRoomTypeResponse update(
            UUID hotelId, String hotelHeader, UUID roomTypeId, ApiDtos.RoomTypeUpdateInput in) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        RoomType rt = roomTypeRepository
                .findByIdAndHotel_Id(roomTypeId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room type not found"));
        String code = in.code().trim().toUpperCase();
        if (!rt.getCode().equalsIgnoreCase(code)
                && roomTypeRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Room type code already exists for this hotel");
        }
        rt.setCode(code);
        rt.setName(in.name().trim());
        rt.setDescription(in.description());
        rt.setMaxOccupancy(in.maxOccupancy());
        rt.setBedCount(in.bedCount());
        rt.setBaseRate(in.baseRate());
        rt.setAmenities(in.amenities() != null ? new ArrayList<>(in.amenities()) : new ArrayList<>());
        rt = roomTypeRepository.save(rt);
        return new ApiDtos.CreateRoomTypeResponse(rt.getId(), rt.getCode(), rt.getName(), "Room type updated");
    }

    @Transactional
    public ApiDtos.DeleteRoomTypeResponse delete(UUID hotelId, String hotelHeader, UUID roomTypeId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        RoomType rt = roomTypeRepository
                .findByIdAndHotel_Id(roomTypeId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room type not found"));
        long linkedRooms = roomRepository.countByHotel_IdAndRoomType_Id(hotelId, roomTypeId);
        if (linkedRooms > 0) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "ROOM_TYPE_HAS_ROOMS",
                    "Cannot delete room type while rooms still use it");
        }
        roomTypeRepository.delete(rt);
        return new ApiDtos.DeleteRoomTypeResponse(roomTypeId, "Room type deleted");
    }

    /** Used by one-time setup (no tenant header). */
    @Transactional
    public ApiDtos.CreateRoomTypeResponse createForHotel(Hotel hotel, ApiDtos.RoomTypeCreateInput in) {
        return persistRoomType(hotel, in);
    }

    private ApiDtos.CreateRoomTypeResponse persistRoomType(Hotel hotel, ApiDtos.RoomTypeCreateInput in) {
        String code = in.code().trim();
        if (roomTypeRepository.existsByHotel_IdAndCodeIgnoreCase(hotel.getId(), code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Room type code already exists for this hotel");
        }
        RoomType rt = new RoomType();
        rt.setHotel(hotel);
        rt.setCode(code.toUpperCase());
        rt.setName(in.name().trim());
        rt.setDescription(in.description());
        rt.setMaxOccupancy(in.maxOccupancy());
        rt.setBedCount(in.bedCount());
        rt.setBaseRate(in.baseRate());
        if (in.amenities() != null) {
            rt.setAmenities(new ArrayList<>(in.amenities()));
        }
        rt = roomTypeRepository.save(rt);
        return new ApiDtos.CreateRoomTypeResponse(rt.getId(), rt.getCode(), rt.getName(), "Room type created");
    }

    private void ensureHotel(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
    }
}
