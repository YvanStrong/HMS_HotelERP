package com.hms.repository;

import com.hms.entity.EventBillingDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventBillingDocumentRepository extends JpaRepository<EventBillingDocument, UUID> {

    Optional<EventBillingDocument> findByEventQuote_Id(UUID eventQuoteId);

    Optional<EventBillingDocument> findByIdAndHotel_Id(UUID id, UUID hotelId);

    @Query(
            """
            select d from EventBillingDocument d
            join fetch d.eventBooking eb
            join fetch d.groupBooking gb
            join fetch d.eventQuote q
            where d.hotel.id = :hotelId
            order by d.updatedAt desc
            """)
    List<EventBillingDocument> findByHotel_IdOrderByUpdatedAtDesc(@Param("hotelId") UUID hotelId);

    @Query(
            value =
                    """
            select coalesce(max(cast(substring(document_number from '[0-9]+$') as integer)), 0)
            from event_billing_documents
            where hotel_id = :hotelId and document_number like :prefix
            """,
            nativeQuery = true)
    int maxSuffixForPrefix(@Param("hotelId") UUID hotelId, @Param("prefix") String prefix);
}
