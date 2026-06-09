package com.hms.service;

import com.hms.api.dto.EventBookingDtos;
import com.hms.api.dto.EventOpsDtos;
import com.hms.domain.EventBookingStatus;
import com.hms.domain.EventBookingType;
import com.hms.entity.DepotProduct;
import com.hms.entity.EventBooking;
import com.hms.entity.Facility;
import com.hms.entity.GroupBooking;
import com.hms.entity.Hotel;
import com.hms.repository.BanquetEventOrderRepository;
import com.hms.repository.DepotProductRepository;
import com.hms.repository.EventBookingRepository;
import com.hms.repository.EventQuoteRepository;
import com.hms.repository.FacilityRepository;
import com.hms.repository.GroupBookingRepository;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EventBookingService {

    private final EventBookingRepository eventBookingRepository;
    private final GroupBookingRepository groupBookingRepository;
    private final HotelRepository hotelRepository;
    private final FacilityRepository facilityRepository;
    private final FacilityService facilityService;
    private final TenantAccessService tenantAccessService;
    private final EventQuoteRepository eventQuoteRepository;
    private final BanquetEventOrderRepository banquetEventOrderRepository;
    private final DepotProductRepository depotProductRepository;

    @Transactional(readOnly = true)
    public List<EventBookingDtos.EventBookingResponse> listByGroup(UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGroup(hotelId, groupId);
        return eventBookingRepository.findByHotel_IdAndGroupBooking_IdOrderByStartDatetimeAsc(hotelId, groupId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EventOpsDtos.EventListItem> listEnrichedByGroup(UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGroup(hotelId, groupId);
        return eventBookingRepository.findByHotel_IdAndGroupBooking_IdOrderByStartDatetimeAsc(hotelId, groupId).stream()
                .map(this::toListItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EventOpsDtos.EventListItem> listUpcomingForHotel(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return eventBookingRepository
                .findByHotel_IdAndStartDatetimeGreaterThanEqualAndStatusNotOrderByStartDatetimeAsc(
                        hotelId, LocalDateTime.now().minusDays(1), EventBookingStatus.CANCELLED)
                .stream()
                .map(this::toListItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EventOpsDtos.VenueOption> listVenues(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return facilityRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(f -> new EventOpsDtos.VenueOption(f.getId(), f.getName(), f.getCode()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EventOpsDtos.DepotProductOption> listDepotProducts(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return depotProductRepository.search(hotelId, null, true).stream()
                .map(p -> new EventOpsDtos.DepotProductOption(
                        p.getId(), p.getProductName(), p.getProductCode(), p.getSellingPrice(), p.isTaxable()))
                .toList();
    }

    private EventOpsDtos.EventListItem toListItem(EventBooking event) {
        var quote = eventQuoteRepository.findByEventBooking_Id(event.getId()).orElse(null);
        var beo = banquetEventOrderRepository.findByEventBooking_Id(event.getId()).orElse(null);
        return new EventOpsDtos.EventListItem(
                toResponse(event),
                quote != null ? quote.getStatus() : null,
                beo != null ? beo.getStatus() : null,
                quote != null ? quote.getId() : null,
                beo != null ? beo.getId() : null);
    }

    @Transactional(readOnly = true)
    public EventBookingDtos.EventBookingResponse detail(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return toResponse(getEvent(hotelId, groupId, eventId));
    }

    @Transactional
    public EventBookingDtos.EventBookingResponse create(
            UUID hotelId, String hotelHeader, UUID groupId, EventBookingDtos.EventBookingRequest request) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        GroupBooking group = assertGroup(hotelId, groupId);
        validateRequest(hotelId, null, request);

        EventBooking event = new EventBooking();
        event.setHotel(hotel);
        event.setGroupBooking(group);
        applyRequest(event, request);
        return toResponse(eventBookingRepository.save(event));
    }

    @Transactional
    public EventBookingDtos.EventBookingResponse update(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId, EventBookingDtos.EventBookingRequest request) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        EventBooking event = getEvent(hotelId, groupId, eventId);
        validateRequest(hotelId, eventId, request);
        applyRequest(event, request);
        return toResponse(eventBookingRepository.save(event));
    }

    @Transactional
    public EventBookingDtos.EventBookingResponse cancel(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        EventBooking event = getEvent(hotelId, groupId, eventId);
        event.setStatus(EventBookingStatus.CANCELLED);
        return toResponse(eventBookingRepository.save(event));
    }

    @Transactional(readOnly = true)
    public EventBookingDtos.EventConflictResponse conflictCheck(
            UUID hotelId,
            String hotelHeader,
            UUID groupId,
            UUID venueOrFacilityId,
            LocalDateTime startDatetime,
            LocalDateTime endDatetime,
            UUID excludeEventId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGroup(hotelId, groupId);
        if (venueOrFacilityId == null) {
            return new EventBookingDtos.EventConflictResponse(false, "No facility selected.");
        }
        validateWindow(startDatetime, endDatetime);
        boolean conflict = hasVenueConflict(hotelId, venueOrFacilityId, startDatetime, endDatetime, excludeEventId);
        String message = conflict
                ? "This venue already has a booking in the selected time window."
                : "No venue conflict found for the selected time window.";
        return new EventBookingDtos.EventConflictResponse(conflict, message);
    }

    private GroupBooking assertGroup(UUID hotelId, UUID groupId) {
        return groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    private EventBooking getEvent(UUID hotelId, UUID groupId, UUID eventId) {
        return eventBookingRepository
                .findByIdAndHotel_IdAndGroupBooking_Id(eventId, hotelId, groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event not found"));
    }

    private void validateRequest(UUID hotelId, UUID excludeEventId, EventBookingDtos.EventBookingRequest request) {
        validateWindow(request.startDatetime(), request.endDatetime());
        Integer expected = request.expectedPax();
        Integer guaranteed = request.guaranteedPax();
        if (guaranteed != null && expected != null && guaranteed > expected) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Guaranteed pax cannot be greater than expected pax");
        }
        EventBookingStatus status =
                request.status() != null ? request.status() : EventBookingStatus.TENTATIVE;
        if (status == EventBookingStatus.CONFIRMED && request.venueOrFacilityId() != null) {
            if (hasVenueConflict(
                    hotelId, request.venueOrFacilityId(), request.startDatetime(), request.endDatetime(), excludeEventId)) {
                throw new ApiException(
                        HttpStatus.CONFLICT, "This venue already has a booking in the selected time window.");
            }
        }
    }

    private boolean hasVenueConflict(
            UUID hotelId, UUID venueOrFacilityId, LocalDateTime startDatetime, LocalDateTime endDatetime, UUID excludeEventId) {
        boolean eventConflict = eventBookingRepository.countVenueConflicts(
                        hotelId,
                        venueOrFacilityId,
                        startDatetime,
                        endDatetime,
                        EventBookingStatus.CANCELLED,
                        excludeEventId)
                > 0;
        boolean facilityConflict = facilityService.facilityExistsForHotel(hotelId, venueOrFacilityId)
                && facilityService.hasActiveBookingConflict(hotelId, venueOrFacilityId, startDatetime, endDatetime);
        return eventConflict || facilityConflict;
    }

    private void validateWindow(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Event start and end time are required");
        }
        if (!start.isBefore(end)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Event end time must be after start time");
        }
    }

    private void applyRequest(EventBooking event, EventBookingDtos.EventBookingRequest request) {
        event.setEventName(request.eventName().trim());
        event.setEventType(request.eventType() != null ? request.eventType() : EventBookingType.OTHER);
        event.setStatus(request.status() != null ? request.status() : EventBookingStatus.TENTATIVE);
        event.setStartDatetime(request.startDatetime());
        event.setEndDatetime(request.endDatetime());
        event.setSetupStyle(blankToNull(request.setupStyle()));
        event.setExpectedPax(request.expectedPax());
        event.setGuaranteedPax(request.guaranteedPax());
        event.setVenueOrFacilityId(request.venueOrFacilityId());
        event.setCoordinatorNotes(blankToNull(request.coordinatorNotes()));
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private EventBookingDtos.EventBookingResponse toResponse(EventBooking event) {
        String venueName = null;
        if (event.getVenueOrFacilityId() != null) {
            venueName = facilityRepository
                    .findByIdAndHotel_Id(event.getVenueOrFacilityId(), event.getHotel().getId())
                    .map(Facility::getName)
                    .orElse(null);
        }
        return new EventBookingDtos.EventBookingResponse(
                event.getId(),
                event.getHotel().getId(),
                event.getGroupBooking().getId(),
                event.getEventName(),
                event.getEventType(),
                event.getStatus(),
                event.getStartDatetime(),
                event.getEndDatetime(),
                event.getSetupStyle(),
                event.getExpectedPax(),
                event.getGuaranteedPax(),
                event.getVenueOrFacilityId(),
                venueName,
                event.getCoordinatorNotes());
    }
}
