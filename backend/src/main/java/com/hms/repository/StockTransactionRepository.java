package com.hms.repository;

import com.hms.domain.StockTransactionType;
import com.hms.entity.StockTransaction;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockTransactionRepository extends JpaRepository<StockTransaction, UUID> {

    List<StockTransaction> findByItem_IdOrderByTimestampDesc(UUID itemId);

    @Query("select max(t.timestamp) from StockTransaction t where t.item.id = :itemId and t.type = :type")
    Optional<Instant> findLastReceiptTime(@Param("itemId") UUID itemId, @Param("type") StockTransactionType type);
}
