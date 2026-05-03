package com.hms.repository;

import com.hms.entity.DepotProduct;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DepotProductRepository extends JpaRepository<DepotProduct, UUID> {

    @Query("select coalesce(max(p.productNumber), 0) from DepotProduct p where p.hotel.id = :hotelId")
    int findMaxProductNumber(@Param("hotelId") UUID hotelId);

    boolean existsByHotel_IdAndProductCodeIgnoreCase(UUID hotelId, String productCode);

    Optional<DepotProduct> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @Query(
            """
            select p from DepotProduct p
            join fetch p.depot d
            where p.hotel.id = :hotelId
            and (:depotId is null or d.id = :depotId)
            and (:activeOnly = false or p.active = true)
            order by p.menuName asc, p.productName asc
            """)
    List<DepotProduct> search(
            @Param("hotelId") UUID hotelId,
            @Param("depotId") UUID depotId,
            @Param("activeOnly") boolean activeOnly);

    List<DepotProduct> findByHotel_IdAndProductCodeStartingWithIgnoreCase(UUID hotelId, String codePrefix);
}
