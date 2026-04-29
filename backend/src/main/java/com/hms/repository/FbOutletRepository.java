package com.hms.repository;

import com.hms.entity.FbOutlet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FbOutletRepository extends JpaRepository<FbOutlet, UUID> {

    long countByHotel_Id(UUID hotelId);

    Optional<FbOutlet> findByIdAndHotel_Id(UUID id, UUID hotelId);

    List<FbOutlet> findByHotel_IdOrderByNameAsc(UUID hotelId);

    boolean existsByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);
}
