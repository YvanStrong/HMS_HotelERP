package com.hms.repository;

import com.hms.entity.DeviceStateLog;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceStateLogRepository extends JpaRepository<DeviceStateLog, UUID> {

    Page<DeviceStateLog> findByDevice_IdOrderByRecordedAtDesc(UUID deviceId, Pageable pageable);
}
