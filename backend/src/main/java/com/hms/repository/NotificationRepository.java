package com.hms.repository;

import com.hms.entity.Notification;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    boolean existsByHotel_IdAndRecipientIdAndTypeAndReferenceTypeAndReferenceIdAndScheduledForBetween(
            UUID hotelId,
            UUID recipientId,
            String type,
            String referenceType,
            UUID referenceId,
            Instant from,
            Instant to);

    List<Notification> findTop25ByChannelAndStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
            String channel, String status, Instant scheduledFor);

    List<Notification> findTop25ByChannelAndStatusAndRecipientAddressIsNullOrderByScheduledForAsc(
            String channel, String status);
}
