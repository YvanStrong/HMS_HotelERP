package com.hms.repository;

import com.hms.entity.EbmSyncCursor;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EbmSyncCursorRepository extends JpaRepository<EbmSyncCursor, EbmSyncCursor.Pk> {
    List<EbmSyncCursor> findByDeviceId(UUID deviceId);

    Optional<EbmSyncCursor> findByDeviceIdAndCategory(UUID deviceId, String category);
}
