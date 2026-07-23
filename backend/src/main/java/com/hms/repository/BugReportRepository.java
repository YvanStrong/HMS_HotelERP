package com.hms.repository;

import com.hms.domain.BugReportStatus;
import com.hms.entity.BugReport;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BugReportRepository extends JpaRepository<BugReport, UUID> {

    List<BugReport> findAllByOrderByCreatedAtDesc();

    List<BugReport> findByStatusOrderByCreatedAtDesc(BugReportStatus status);
}
