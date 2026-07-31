package com.hms.repository;

import com.hms.entity.InvWarehouse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvWarehouseRepository extends JpaRepository<InvWarehouse, UUID> {
    List<InvWarehouse> findByHotel_IdAndActiveTrueOrderByNameAsc(UUID hotelId);

    Optional<InvWarehouse> findByIdAndHotel_Id(UUID id, UUID hotelId);

    Optional<InvWarehouse> findByHotel_IdAndIsDefaultTrue(UUID hotelId);

    Optional<InvWarehouse> findByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);

    boolean existsByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);

    boolean existsByHotel_IdAndCodeIgnoreCaseAndIdNot(UUID hotelId, String code, UUID id);
}
