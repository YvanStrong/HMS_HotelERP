package com.hms.repository;

import com.hms.entity.ChannelConnection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelConnectionRepository extends JpaRepository<ChannelConnection, UUID> {

    List<ChannelConnection> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    List<ChannelConnection> findByHotel_IdAndStatus(UUID hotelId, String status);
}
