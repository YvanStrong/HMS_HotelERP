package com.hms.repository;

import com.hms.entity.PosTable;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PosTableRepository extends JpaRepository<PosTable, UUID> {

    List<PosTable> findByHotel_IdAndDepot_IdAndActiveTrueOrderBySortOrderAsc(UUID hotelId, UUID depotId);

    List<PosTable> findByHotel_IdAndDepot_IdOrderBySortOrderAsc(UUID hotelId, UUID depotId);

    @Query(
            """
            select t from PosTable t join fetch t.depot
            where t.hotel.id = :hotelId and t.active = true
            order by t.depot.name asc, t.sortOrder asc
            """)
    List<PosTable> findByHotel_IdAndActiveTrueOrderByDepotNameSortOrder(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select t from PosTable t join fetch t.depot
            where t.hotel.id = :hotelId
            order by t.depot.name asc, t.sortOrder asc
            """)
    List<PosTable> findByHotel_IdOrderByDepotNameSortOrder(@Param("hotelId") UUID hotelId);

    java.util.Optional<PosTable> findByIdAndHotel_Id(UUID id, UUID hotelId);

    boolean existsByHotel_IdAndDepot_IdAndTableLabelIgnoreCase(UUID hotelId, UUID depotId, String tableLabel);

    long countByDepot_Id(UUID depotId);
}
