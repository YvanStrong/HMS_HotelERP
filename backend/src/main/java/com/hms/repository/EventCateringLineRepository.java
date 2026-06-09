package com.hms.repository;

import com.hms.entity.EventCateringLine;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventCateringLineRepository extends JpaRepository<EventCateringLine, UUID> {

    List<EventCateringLine> findByEventBooking_IdOrderByCreatedAtAsc(UUID eventId);

    Optional<EventCateringLine> findByIdAndEventBooking_Id(UUID id, UUID eventId);
}
