package com.hms.service;

import com.hms.entity.*;
import com.hms.repository.*;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service request management — handles guest in-stay requests
 * (extra towels, room service, maintenance, etc.) from mobile/PWA.
 */
@Service
public class ServiceRequestService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestService.class);

    private final ServiceRequestRepository repo;
    private final HotelRepository hotelRepo;

    public ServiceRequestService(ServiceRequestRepository repo, HotelRepository hotelRepo) {
        this.repo = repo;
        this.hotelRepo = hotelRepo;
    }

    @Transactional
    public ServiceRequest create(UUID hotelId, ServiceRequest request) {
        Hotel hotel = hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found."));
        request.setHotel(hotel);
        request.setStatus("PENDING");
        log.info("Service request created: type={} hotel={}", request.getRequestType(), hotelId);
        return repo.save(request);
    }

    @Transactional
    public ServiceRequest updateStatus(UUID requestId, String newStatus, UUID assignedToId) {
        ServiceRequest sr = repo.findById(requestId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "REQUEST_NOT_FOUND", "Service request not found."));
        sr.setStatus(newStatus);
        if ("COMPLETED".equals(newStatus)) {
            sr.setCompletedAt(Instant.now());
        }
        log.info("Service request {} updated to {}", requestId, newStatus);
        return repo.save(sr);
    }

    @Transactional(readOnly = true)
    public List<ServiceRequest> listByReservation(UUID reservationId) {
        return repo.findByReservation_IdOrderByCreatedAtDesc(reservationId);
    }

    @Transactional(readOnly = true)
    public List<ServiceRequest> listPending(UUID hotelId) {
        return repo.findByHotel_IdAndStatusIn(hotelId, List.of("PENDING", "ASSIGNED", "IN_PROGRESS"));
    }
}
