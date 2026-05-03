package com.hms.repository;

import com.hms.entity.InventoryDepot;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryDepotRepository extends JpaRepository<InventoryDepot, UUID> {
    List<InventoryDepot> findByHotel_IdOrderByNameAsc(UUID hotelId);

    boolean existsByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);

    Optional<InventoryDepot> findByIdAndHotel_Id(UUID id, UUID hotelId);
}
