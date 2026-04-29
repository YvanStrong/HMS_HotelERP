package com.hms.repository;

import com.hms.entity.RoomType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomTypeRepository extends JpaRepository<RoomType, UUID> {

    long countByHotel_Id(UUID hotelId);

    List<RoomType> findByHotel_Id(UUID hotelId);

    Optional<RoomType> findByIdAndHotel_Id(UUID id, UUID hotelId);

    boolean existsByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);

    Optional<RoomType> findByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);
}
