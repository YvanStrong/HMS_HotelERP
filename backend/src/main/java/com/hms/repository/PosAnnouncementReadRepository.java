package com.hms.repository;

import com.hms.entity.PosAnnouncementRead;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PosAnnouncementReadRepository
        extends JpaRepository<PosAnnouncementRead, PosAnnouncementRead.AnnouncementReadId> {

    boolean existsByAnnouncementIdAndUserId(UUID announcementId, UUID userId);
}
