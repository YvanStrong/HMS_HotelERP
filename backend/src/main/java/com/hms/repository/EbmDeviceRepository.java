package com.hms.repository;

import com.hms.entity.EbmDevice;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EbmDeviceRepository extends JpaRepository<EbmDevice, UUID> {
    List<EbmDevice> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    Optional<EbmDevice> findFirstByHotel_IdAndStatusOrderByCreatedAtDesc(UUID hotelId, String status);

    Optional<EbmDevice> findByIdAndHotel_Id(UUID id, UUID hotelId);

    List<EbmDevice> findByStatus(String status);
}
