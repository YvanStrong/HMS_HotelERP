package com.hms.repository;

import com.hms.entity.ServiceRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, UUID> {

    Page<ServiceRequest> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId, Pageable pageable);

    Page<ServiceRequest> findByHotel_IdAndStatusOrderByCreatedAtDesc(UUID hotelId, String status, Pageable pageable);

    List<ServiceRequest> findByReservation_IdOrderByCreatedAtDesc(UUID reservationId);

    List<ServiceRequest> findByHotel_IdAndStatusIn(UUID hotelId, List<String> statuses);
}
