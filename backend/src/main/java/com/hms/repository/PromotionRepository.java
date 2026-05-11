package com.hms.repository;

import com.hms.entity.Promotion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    List<Promotion> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    Optional<Promotion> findByHotel_IdAndCode(UUID hotelId, String code);

    List<Promotion> findByHotel_IdAndActiveTrue(UUID hotelId);
}
