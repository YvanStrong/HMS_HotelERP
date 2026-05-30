package com.hms.repository;

import com.hms.entity.InvFabricationFormula;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvFabricationFormulaRepository extends JpaRepository<InvFabricationFormula, UUID> {

    @Query(
            """
            select distinct f from InvFabricationFormula f
            join fetch f.outputItem o
            left join fetch f.lines l
            left join fetch l.component c
            where f.hotel.id = :hotelId
            order by f.name asc
            """)
    List<InvFabricationFormula> findDetailedByHotelId(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select distinct f from InvFabricationFormula f
            join fetch f.outputItem o
            left join fetch f.lines l
            left join fetch l.component c
            where f.id = :id and f.hotel.id = :hotelId
            """)
    Optional<InvFabricationFormula> findDetailedByIdAndHotelId(
            @Param("id") UUID id, @Param("hotelId") UUID hotelId);
}
