package com.hms.repository;

import com.hms.entity.PettyCashRequest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PettyCashRequestRepository extends JpaRepository<PettyCashRequest, UUID> {

    long countByHotel_Id(UUID hotelId);

    List<PettyCashRequest> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    Optional<PettyCashRequest> findByIdAndHotel_Id(UUID id, UUID hotelId);

    long countByHotel_IdAndStatus(UUID hotelId, String status);

    @Query(
            """
            select coalesce(sum(p.amountApproved), 0)
            from PettyCashRequest p
            where p.hotel.id = :hotelId
              and p.status = 'DISBURSED'
            """)
    BigDecimal sumDisbursed(@Param("hotelId") UUID hotelId);
}
