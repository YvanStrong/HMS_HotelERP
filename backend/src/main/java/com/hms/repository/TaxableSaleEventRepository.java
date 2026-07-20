package com.hms.repository;

import com.hms.entity.TaxableSaleEvent;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaxableSaleEventRepository extends JpaRepository<TaxableSaleEvent, UUID> {
    Optional<TaxableSaleEvent> findBySourceTypeAndSourceId(String sourceType, UUID sourceId);

    List<TaxableSaleEvent> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId, Pageable pageable);

    long countByHotel_IdAndEbmStatus(UUID hotelId, String ebmStatus);
}
