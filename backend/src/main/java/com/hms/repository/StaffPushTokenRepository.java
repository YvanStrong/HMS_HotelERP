package com.hms.repository;

import com.hms.entity.StaffPushToken;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffPushTokenRepository extends JpaRepository<StaffPushToken, UUID> {

    List<StaffPushToken> findByUser_IdAndActiveTrue(UUID userId);

    Optional<StaffPushToken> findByHotel_IdAndUser_IdAndDeviceId(UUID hotelId, UUID userId, String deviceId);

    List<StaffPushToken> findByHotel_IdAndUser_Id(UUID hotelId, UUID userId);
}
