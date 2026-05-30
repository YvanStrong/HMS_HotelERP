package com.hms.repository;

import com.hms.entity.PurchaseOrder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    Optional<PurchaseOrder> findByIdAndHotel_Id(UUID id, UUID hotelId);

    long countByHotel_Id(UUID hotelId);

    List<PurchaseOrder> findByHotel_IdOrderByOrderDateDesc(UUID hotelId);

    @Query(
            "select count(p) from PurchaseOrder p where p.hotel.id = :hotelId and p.status <> 'COMPLETED' and p.status <> 'CANCELLED'")
    long countOpenByHotel(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select p.poNumber
            from PurchaseOrder p
            where p.poNumber like :prefix
            order by p.poNumber desc
            limit 1
            """)
    Optional<String> findLastPoNumberByPrefix(@Param("prefix") String prefix);

    @Query(
            """
            select p from PurchaseOrder p
            join fetch p.supplier s
            where p.hotel.id = :hotelId
              and p.orderDate >= :from
              and p.orderDate < :to
              and p.status <> com.hms.domain.PurchaseOrderStatus.CANCELLED
            order by p.orderDate desc
            """)
    List<PurchaseOrder> findAccountingPurchasesBetween(
            @Param("hotelId") UUID hotelId,
            @Param("from") java.time.Instant from,
            @Param("to") java.time.Instant to);
}
