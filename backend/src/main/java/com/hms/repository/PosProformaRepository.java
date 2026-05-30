package com.hms.repository;

import com.hms.entity.PosProforma;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosProformaRepository extends JpaRepository<PosProforma, UUID> {

    @Query("select count(p) from PosProforma p where p.hotel.id = :hotelId")
    long countByHotelId(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select p from PosProforma p
            join fetch p.depot d
            where p.hotel.id = :hotelId
            and (:depotId is null or d.id = :depotId)
            order by p.createdAt desc
            """)
    List<PosProforma> findByHotelId(@Param("hotelId") UUID hotelId, @Param("depotId") UUID depotId);

    @Query(
            """
            select distinct p from PosProforma p
            join fetch p.depot d
            left join fetch p.lines pl
            left join fetch pl.product
            where p.id = :proformaId and p.hotel.id = :hotelId
            """)
    Optional<PosProforma> findFetchedByIdAndHotelId(
            @Param("proformaId") UUID proformaId, @Param("hotelId") UUID hotelId);
}
