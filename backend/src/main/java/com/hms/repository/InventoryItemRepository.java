package com.hms.repository;

import com.hms.entity.InventoryItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, UUID> {

    Optional<InventoryItem> findByIdAndHotel_Id(UUID id, UUID hotelId);

    Optional<InventoryItem> findByHotel_IdAndSkuIgnoreCase(UUID hotelId, String sku);

    List<InventoryItem> findByHotel_IdOrderByNameAsc(UUID hotelId);

    /**
     * Category filter uses id so we never call {@code upper()} on {@code category.code} (PostgreSQL may map legacy
     * columns as bytea, which breaks {@code upper(bytea)}).
     */
    @Query(
            """
            select i from InventoryItem i join fetch i.category c left join fetch i.preferredSupplier
            where i.hotel.id = :hotelId
            and (:categoryId is null or c.id = :categoryId)
            and (:search is null or lower(i.name) like lower(concat('%', :search, '%'))
                 or lower(i.sku) like lower(concat('%', :search, '%')))
            """)
    List<InventoryItem> search(
            @Param("hotelId") UUID hotelId,
            @Param("categoryId") UUID categoryId,
            @Param("search") String search);

    long countByHotel_Id(UUID hotelId);

    @Query(
            "select count(i) from InventoryItem i where i.hotel.id = :hotelId and i.currentStock < i.reorderPoint")
    long countLowStock(@Param("hotelId") UUID hotelId);

    @Query("select count(i) from InventoryItem i where i.hotel.id = :hotelId and i.currentStock <= 0")
    long countOutOfStock(@Param("hotelId") UUID hotelId);

    @Query(
            "select coalesce(sum(i.currentStock * coalesce(i.unitCost, 0)), 0) from InventoryItem i where i.hotel.id = :hotelId")
    java.math.BigDecimal sumStockValue(@Param("hotelId") UUID hotelId);
}
