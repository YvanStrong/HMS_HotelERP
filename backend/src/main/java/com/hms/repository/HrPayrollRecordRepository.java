package com.hms.repository;

import com.hms.entity.HrPayrollRecord;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HrPayrollRecordRepository extends JpaRepository<HrPayrollRecord, UUID> {

    @Query("select r from HrPayrollRecord r join fetch r.user u where r.hotel.id = :hotelId and r.periodYear = :year and r.periodMonth = :month order by u.username")
    List<HrPayrollRecord> findByHotelAndPeriod(@Param("hotelId") UUID hotelId, @Param("year") int year, @Param("month") int month);

    @Query("select r from HrPayrollRecord r join fetch r.user u where r.hotel.id = :hotelId order by r.periodYear desc, r.periodMonth desc, u.username")
    List<HrPayrollRecord> findByHotelId(@Param("hotelId") UUID hotelId);

    @Query("select r from HrPayrollRecord r where r.hotel.id = :hotelId and r.user.id = :userId and r.periodYear = :year and r.periodMonth = :month")
    Optional<HrPayrollRecord> findByHotelUserAndPeriod(@Param("hotelId") UUID hotelId, @Param("userId") UUID userId, @Param("year") int year, @Param("month") int month);

    @Query("select r from HrPayrollRecord r join fetch r.user u where r.hotel.id = :hotelId and r.user.id = :userId and r.periodYear = :year and r.periodMonth = :month order by r.createdAt desc")
    List<HrPayrollRecord> findAllByHotelUserAndPeriod(
            @Param("hotelId") UUID hotelId, @Param("userId") UUID userId, @Param("year") int year, @Param("month") int month);

    @Query("select r from HrPayrollRecord r join fetch r.user u where r.hotel.id = :hotelId and r.user.id = :userId order by r.periodYear desc, r.periodMonth desc, r.createdAt desc")
    List<HrPayrollRecord> findByHotelAndUser(@Param("hotelId") UUID hotelId, @Param("userId") UUID userId);

    @Query("""
            select r from HrPayrollRecord r join fetch r.user u
            where r.hotel.id = :hotelId and r.status = 'PAID' and r.accountingExpenseId is null
            order by r.periodYear desc, r.periodMonth desc
            """)
    List<HrPayrollRecord> findPaidWithoutAccountingExpense(@Param("hotelId") UUID hotelId);
}
