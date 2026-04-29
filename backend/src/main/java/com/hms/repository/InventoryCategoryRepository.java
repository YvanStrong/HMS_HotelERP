package com.hms.repository;

import com.hms.entity.InventoryCategory;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryCategoryRepository extends JpaRepository<InventoryCategory, UUID> {

    @Query("SELECT COUNT(c) FROM InventoryCategory c WHERE c.hotel.id = :hotelId")
    long countByHotel_Id(@Param("hotelId") UUID hotelId);

    List<InventoryCategory> findByHotel_IdOrderByNameAsc(UUID hotelId);

    Optional<InventoryCategory> findByIdAndHotel_Id(UUID id, UUID hotelId);

    Optional<InventoryCategory> findByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);

    boolean existsByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);
}
