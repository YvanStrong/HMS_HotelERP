package com.hms.repository;

import com.hms.domain.DutyShiftCode;
import com.hms.domain.DutyShiftStatus;
import com.hms.entity.HrDutyShift;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrDutyShiftRepository extends JpaRepository<HrDutyShift, UUID> {

    @Query("""
            select d from HrDutyShift d
            join fetch d.user u
            where d.hotel.id = :hotelId
              and d.dutyDate between :from and :to
              and (:shift is null or d.shiftCode = :shift)
              and (:status is null or d.status = :status)
              and (:userId is null or u.id = :userId)
            order by d.dutyDate desc, d.startTime asc, u.username asc
            """)
    List<HrDutyShift> search(
            @Param("hotelId") UUID hotelId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("shift") DutyShiftCode shift,
            @Param("status") DutyShiftStatus status,
            @Param("userId") UUID userId);

    Optional<HrDutyShift> findByIdAndHotel_Id(UUID id, UUID hotelId);

    long countByHotel_IdAndDutyDateAndStatus(UUID hotelId, LocalDate dutyDate, DutyShiftStatus status);

    long countByHotel_IdAndDutyDate(UUID hotelId, LocalDate dutyDate);
}
