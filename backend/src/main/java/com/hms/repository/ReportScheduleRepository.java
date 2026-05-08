package com.hms.repository;

import com.hms.entity.ReportSchedule;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportScheduleRepository extends JpaRepository<ReportSchedule, UUID> {

    List<ReportSchedule> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    List<ReportSchedule> findByActiveTrue();
}
