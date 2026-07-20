package com.hms.repository;

import com.hms.entity.HrLeaveBalance;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrLeaveBalanceRepository extends JpaRepository<HrLeaveBalance, UUID> {

    @Query("select b from HrLeaveBalance b join fetch b.user u join fetch b.leaveType lt where b.hotel.id = :hotelId and b.year = :year order by u.username, lt.name")
    List<HrLeaveBalance> findByHotelAndYear(@Param("hotelId") UUID hotelId, @Param("year") int year);

    @Query("select b from HrLeaveBalance b where b.hotel.id = :hotelId and b.user.id = :userId and b.year = :year")
    List<HrLeaveBalance> findByHotelUserAndYear(@Param("hotelId") UUID hotelId, @Param("userId") UUID userId, @Param("year") int year);

    @Query("select b from HrLeaveBalance b where b.hotel.id = :hotelId and b.user.id = :userId and b.leaveType.id = :typeId and b.year = :year")
    Optional<HrLeaveBalance> findByHotelUserTypeAndYear(@Param("hotelId") UUID hotelId, @Param("userId") UUID userId, @Param("typeId") UUID typeId, @Param("year") int year);
}
