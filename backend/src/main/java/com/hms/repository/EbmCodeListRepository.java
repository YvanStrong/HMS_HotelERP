package com.hms.repository;

import com.hms.entity.EbmCodeListEntry;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EbmCodeListRepository extends JpaRepository<EbmCodeListEntry, UUID> {
    List<EbmCodeListEntry> findByHotel_IdAndCategoryOrderByCodeAsc(UUID hotelId, String category);

    List<EbmCodeListEntry> findByHotel_IdOrderByCategoryAscCodeAsc(UUID hotelId);

    Optional<EbmCodeListEntry> findByHotel_IdAndCategoryAndCode(UUID hotelId, String category, String code);
}
