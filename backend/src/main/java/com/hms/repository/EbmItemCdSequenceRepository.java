package com.hms.repository;

import com.hms.entity.EbmItemCdSequence;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface EbmItemCdSequenceRepository extends JpaRepository<EbmItemCdSequence, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from EbmItemCdSequence s where s.hotelId = :hotelId")
    Optional<EbmItemCdSequence> findForUpdate(@Param("hotelId") UUID hotelId);
}
