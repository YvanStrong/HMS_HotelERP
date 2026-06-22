package com.hms.repository;

import com.hms.entity.HrEmployeeProfile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrEmployeeProfileRepository extends JpaRepository<HrEmployeeProfile, UUID> {

    @Query("select p from HrEmployeeProfile p join fetch p.user u where p.hotel.id = :hotelId order by u.username")
    List<HrEmployeeProfile> findByHotelIdWithUser(@Param("hotelId") UUID hotelId);

    @Query("select p from HrEmployeeProfile p where p.hotel.id = :hotelId and p.user.id = :userId")
    Optional<HrEmployeeProfile> findByHotelIdAndUserId(@Param("hotelId") UUID hotelId, @Param("userId") UUID userId);
}
