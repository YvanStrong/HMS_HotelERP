package com.hms.repository;

import com.hms.entity.HrLeaveRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrLeaveRequestRepository extends JpaRepository<HrLeaveRequest, UUID> {

    @Query("select r from HrLeaveRequest r join fetch r.user u join fetch r.leaveType lt where r.hotel.id = :hotelId order by r.createdAt desc")
    List<HrLeaveRequest> findByHotelId(@Param("hotelId") UUID hotelId);

    @Query("select r from HrLeaveRequest r join fetch r.user u join fetch r.leaveType lt where r.hotel.id = :hotelId and r.status = :status order by r.createdAt desc")
    List<HrLeaveRequest> findByHotelIdAndStatus(@Param("hotelId") UUID hotelId, @Param("status") String status);

    @Query("select r from HrLeaveRequest r join fetch r.leaveType lt where r.hotel.id = :hotelId and r.user.id = :userId order by r.createdAt desc")
    List<HrLeaveRequest> findByHotelAndUser(@Param("hotelId") UUID hotelId, @Param("userId") UUID userId);
}
