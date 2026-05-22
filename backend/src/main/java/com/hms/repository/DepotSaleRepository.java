package com.hms.repository;

import com.hms.entity.DepotSale;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DepotSaleRepository extends JpaRepository<DepotSale, UUID> {

    @Query("select count(s) from DepotSale s where s.hotel.id = :hotelId")
    long countByHotelId(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select coalesce(sum(s.totalAmount), 0)
            from DepotSale s
            where s.hotel.id = :hotelId
              and s.createdAt >= :from
              and s.createdAt < :to
            """)
    BigDecimal sumSalesBetween(
            @Param("hotelId") UUID hotelId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query(
            """
            select count(s)
            from DepotSale s
            where s.hotel.id = :hotelId
              and s.createdAt >= :from
              and s.createdAt < :to
            """)
    long countSalesBetween(
            @Param("hotelId") UUID hotelId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query(
            """
            select s from DepotSale s
            join fetch s.depot d
            where s.hotel.id = :hotelId
            and (:depotId is null or d.id = :depotId)
            order by s.createdAt desc
            """)
    List<DepotSale> findByHotelId(@Param("hotelId") UUID hotelId, @Param("depotId") UUID depotId);

    /**
     * Left-fetch lines so a sale is still found if lines were empty (edge case); inner join on lines
     * previously made the query return no row → 404 on reprint.
     */
    @Query(
            """
            select distinct s from DepotSale s
            join fetch s.depot d
            left join fetch s.lines sl
            left join fetch sl.product p
            where s.id = :saleId and s.hotel.id = :hotelId
            """)
    Optional<DepotSale> findFetchedByIdAndHotelId(
            @Param("saleId") UUID saleId, @Param("hotelId") UUID hotelId);
}
