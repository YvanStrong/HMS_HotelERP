package com.hms.repository;

import com.hms.entity.HrCandidate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrCandidateRepository extends JpaRepository<HrCandidate, UUID> {

    @Query("select c from HrCandidate c left join fetch c.jobPosition p where c.hotel.id = :hotelId order by c.appliedDate desc")
    List<HrCandidate> findByHotelId(@Param("hotelId") UUID hotelId);

    @Query("select c from HrCandidate c left join fetch c.jobPosition p where c.hotel.id = :hotelId and p.id = :positionId order by c.appliedDate desc")
    List<HrCandidate> findByHotelAndPosition(@Param("hotelId") UUID hotelId, @Param("positionId") UUID positionId);

    long countByJobPosition_Id(UUID positionId);
}
