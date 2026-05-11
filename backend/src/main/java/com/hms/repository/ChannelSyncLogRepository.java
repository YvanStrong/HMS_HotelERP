package com.hms.repository;

import com.hms.entity.ChannelSyncLog;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelSyncLogRepository extends JpaRepository<ChannelSyncLog, UUID> {

    Page<ChannelSyncLog> findByConnection_IdOrderByCreatedAtDesc(UUID connectionId, Pageable pageable);
}
