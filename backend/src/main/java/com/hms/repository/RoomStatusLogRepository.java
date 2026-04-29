package com.hms.repository;

import com.hms.entity.RoomStatusLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomStatusLogRepository extends JpaRepository<RoomStatusLog, UUID> {

    long countByHotelId(UUID hotelId);

    List<RoomStatusLog> findByRoomIdOrderByCreatedAtDesc(UUID roomId, Pageable pageable);
}
