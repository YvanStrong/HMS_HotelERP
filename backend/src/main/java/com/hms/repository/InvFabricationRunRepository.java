package com.hms.repository;

import com.hms.entity.InvFabricationRun;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvFabricationRunRepository extends JpaRepository<InvFabricationRun, UUID> {

    @Query(
            """
            select distinct r from InvFabricationRun r
            join fetch r.outputItem o
            join fetch r.formula f
            left join fetch r.lines l
            left join fetch l.component c
            where r.hotel.id = :hotelId
            order by r.createdAt desc
            """)
    List<InvFabricationRun> findRecentByHotelId(@Param("hotelId") UUID hotelId, Pageable pageable);
}
