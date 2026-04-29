package com.hms.repository;

import com.hms.entity.Supplier;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    long countByHotel_Id(UUID hotelId);

    List<Supplier> findByHotel_IdOrderByNameAsc(UUID hotelId);

    Optional<Supplier> findByIdAndHotel_Id(UUID id, UUID hotelId);
}
