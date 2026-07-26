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

    @org.springframework.data.jpa.repository.Query(
            """
            select p from Promotion p
            where p.hotel.id = :hotelId
              and p.active = true
              and (upper(p.appliesTo) = 'POS' or upper(p.appliesTo) = 'BOTH')
            order by p.createdAt desc
            """)
    List<Promotion> findActivePosPromotions(@org.springframework.data.repository.query.Param("hotelId") UUID hotelId);
}
