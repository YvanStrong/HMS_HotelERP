package com.hms.repository;

import com.hms.entity.RoomDevice;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomDeviceRepository extends JpaRepository<RoomDevice, UUID> {

    List<RoomDevice> findByHotel_IdOrderByDeviceName(UUID hotelId);

    List<RoomDevice> findByRoom_IdOrderByDeviceName(UUID roomId);

    List<RoomDevice> findByHotel_IdAndStatus(UUID hotelId, String status);
}
