package com.hms.repository;

import com.hms.entity.Facility;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacilityRepository extends JpaRepository<Facility, UUID> {

    long countByHotel_Id(UUID hotelId);

    List<Facility> findByHotel_IdOrderByNameAsc(UUID hotelId);

    Optional<Facility> findByIdAndHotel_Id(UUID id, UUID hotelId);

    boolean existsByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);
}
