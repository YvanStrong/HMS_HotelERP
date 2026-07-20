package com.hms.repository;

import com.hms.entity.EbmOutboxEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EbmOutboxRepository extends JpaRepository<EbmOutboxEntry, UUID> {

    @Query(
            """
            select e from EbmOutboxEntry e
            where e.device.id = :deviceId
              and e.status in ('PENDING', 'FAILED')
              and (e.dependsOn is null or e.dependsOn.status = 'ACKED')
            order by e.createdAt asc
            """)
    List<EbmOutboxEntry> findReadyToSubmit(@Param("deviceId") UUID deviceId, Pageable pageable);

    List<EbmOutboxEntry> findByDevice_Hotel_IdOrderByCreatedAtDesc(UUID hotelId, Pageable pageable);

    long countByDevice_Hotel_IdAndStatusIn(UUID hotelId, List<String> statuses);
}
