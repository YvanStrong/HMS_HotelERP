package com.hms.repository;

import com.hms.entity.AccountingExpense;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountingExpenseRepository extends JpaRepository<AccountingExpense, UUID> {

    List<AccountingExpense> findByHotel_IdOrderByExpenseDateDescCreatedAtDesc(UUID hotelId);

    @Query(
            """
            select coalesce(sum(e.amount), 0)
            from AccountingExpense e
            where e.hotel.id = :hotelId
              and e.expenseDate >= :from
              and e.expenseDate <= :to
            """)
    BigDecimal sumExpenses(
            @Param("hotelId") UUID hotelId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(
            """
            select e from AccountingExpense e
            where e.hotel.id = :hotelId
              and e.expenseDate >= :from
              and e.expenseDate <= :to
            order by e.expenseDate desc, e.createdAt desc
            """)
    List<AccountingExpense> findByHotelAndDateRange(
            @Param("hotelId") UUID hotelId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(
            """
            select coalesce(sum(e.amount), 0)
            from AccountingExpense e
            where e.hotel.id = :hotelId
              and e.expenseDate >= :from
              and e.expenseDate <= :to
              and lower(e.category) = lower(:category)
            """)
    BigDecimal sumExpensesByCategory(
            @Param("hotelId") UUID hotelId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("category") String category);
}
