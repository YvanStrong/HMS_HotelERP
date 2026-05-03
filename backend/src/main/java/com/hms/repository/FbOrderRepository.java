package com.hms.repository;

import com.hms.entity.FbOrder;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FbOrderRepository extends JpaRepository<FbOrder, UUID> {

    Optional<FbOrder> findByIdAndOutlet_Hotel_Id(UUID id, UUID hotelId);

    @Query("select count(o) from FbOrder o where o.outlet.hotel.id = :hotelId")
    long countByHotelId(@Param("hotelId") UUID hotelId);

    boolean existsByOrderNumber(String orderNumber);
}
