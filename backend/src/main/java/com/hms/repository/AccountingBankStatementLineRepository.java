package com.hms.repository;

import com.hms.entity.AccountingBankStatementLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountingBankStatementLineRepository extends JpaRepository<AccountingBankStatementLine, UUID> {

    List<AccountingBankStatementLine> findByHotel_IdOrderByBookDateDescCreatedAtDesc(UUID hotelId);

    @Query(
            """
            select b from AccountingBankStatementLine b
            where b.hotel.id = :hotelId
              and b.bookDate >= :from
              and b.bookDate <= :to
            order by b.bookDate desc, b.createdAt desc
            """)
    List<AccountingBankStatementLine> findByHotelAndDateRange(
            @Param("hotelId") UUID hotelId,
            @Param("from") java.time.LocalDate from,
            @Param("to") java.time.LocalDate to);
}

