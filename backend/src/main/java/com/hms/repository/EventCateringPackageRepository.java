package com.hms.repository;

import com.hms.entity.EventCateringPackage;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventCateringPackageRepository extends JpaRepository<EventCateringPackage, UUID> {

    List<EventCateringPackage> findByHotel_IdOrderByPackageNameAsc(UUID hotelId);

    List<EventCateringPackage> findByHotel_IdAndActiveTrueOrderByPackageNameAsc(UUID hotelId);

    Optional<EventCateringPackage> findByIdAndHotel_Id(UUID id, UUID hotelId);
}
