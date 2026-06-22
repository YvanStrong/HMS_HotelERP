package com.hms.repository;

import com.hms.entity.EventQuoteLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventQuoteLineRepository extends JpaRepository<EventQuoteLine, UUID> {

    List<EventQuoteLine> findByEventQuote_IdOrderByCreatedAtAsc(UUID quoteId);
}
