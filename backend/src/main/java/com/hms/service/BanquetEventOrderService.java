package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.EventBookingDtos;
import com.hms.api.dto.EventOpsDtos;
import com.hms.domain.BanquetEventOrderStatus;
import com.hms.domain.EventQuoteStatus;
import com.hms.entity.BanquetEventOrder;
import com.hms.entity.EventBooking;
import com.hms.entity.EventCateringLine;
import com.hms.entity.EventQuote;
import com.hms.repository.BanquetEventOrderRepository;
import com.hms.repository.EventBookingRepository;
import com.hms.repository.EventCateringLineRepository;
import com.hms.repository.EventQuoteRepository;
import com.hms.repository.FacilityRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BanquetEventOrderService {

    private final BanquetEventOrderRepository beoRepository;
    private final EventBookingRepository eventBookingRepository;
    private final EventCateringLineRepository cateringLineRepository;
    private final EventQuoteRepository quoteRepository;
    private final EventQuoteService eventQuoteService;
    private final FacilityRepository facilityRepository;
    private final TenantAccessService tenantAccessService;
    private final ObjectMapper objectMapper;

    @Transactional
    public EventOpsDtos.BeoResponse generateBEO(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        EventBooking event = assertEvent(hotelId, hotelHeader, groupId, eventId);
        if (beoRepository.findByEventBooking_Id(eventId).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "BEO already exists — use revise instead");
        }
        EventQuote quote = quoteRepository.findByEventBooking_Id(eventId).orElse(null);
        if (quote == null
                || (quote.getStatus() != EventQuoteStatus.SENT
                        && quote.getStatus() != EventQuoteStatus.ACCEPTED
                        && quote.getStatus() != EventQuoteStatus.CONTRACTED)) {
            throw new ApiException(
                    HttpStatus.CONFLICT, "Create a quote and mark it at least SENT before generating a BEO");
        }
        BanquetEventOrder beo = new BanquetEventOrder();
        beo.setEventBooking(event);
        beo.setVersion(1);
        beo.setStatus(BanquetEventOrderStatus.DRAFT);
        copyFromEvent(beo, event);
        List<EventCateringLine> lines = cateringLineRepository.findByEventBooking_IdOrderByCreatedAtAsc(eventId);
        beo.setMenuNotes(buildMenuSnapshot(lines));
        beo.setKitchenNotes(buildKitchenNotes(lines, event));
        beo.setHousekeepingNotes(buildHousekeepingNotes(event));
        beo.setCreatedBy(tenantAccessService.currentUser().getUsername());
        beo.setLastUpdatedBy(beo.getCreatedBy());
        return toBeoResponse(beoRepository.save(beo));
    }

    @Transactional
    public EventOpsDtos.BeoResponse revise(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        EventBooking event = assertEvent(hotelId, hotelHeader, groupId, eventId);
        BanquetEventOrder beo = loadBeo(hotelId, hotelHeader, groupId, eventId);
        beo.setVersion(beo.getVersion() + 1);
        beo.setStatus(BanquetEventOrderStatus.REVISED);
        beo.setDistributedAt(null);
        List<EventCateringLine> lines = cateringLineRepository.findByEventBooking_IdOrderByCreatedAtAsc(eventId);
        beo.setMenuNotes(buildMenuSnapshot(lines));
        beo.setKitchenNotes(buildKitchenNotes(lines, event));
        beo.setHousekeepingNotes(buildHousekeepingNotes(event));
        copyFromEvent(beo, event);
        beo.setLastUpdatedBy(tenantAccessService.currentUser().getUsername());
        return toBeoResponse(beoRepository.save(beo));
    }

    @Transactional
    public EventOpsDtos.BeoResponse updateSection(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId, EventOpsDtos.BeoSectionUpdateRequest req) {
        BanquetEventOrder beo = loadBeo(hotelId, hotelHeader, groupId, eventId);
        if (beo.getStatus() == BanquetEventOrderStatus.LOCKED || beo.getStatus() == BanquetEventOrderStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "BEO cannot be edited when status is " + beo.getStatus());
        }
        if (req.agendaItems() != null) beo.setAgendaItems(req.agendaItems());
        if (req.setupStyle() != null) beo.setSetupStyle(req.setupStyle());
        if (req.roomLayoutNotes() != null) beo.setRoomLayoutNotes(req.roomLayoutNotes());
        if (req.expectedPax() != null) beo.setExpectedPax(req.expectedPax());
        if (req.guaranteedPax() != null) beo.setGuaranteedPax(req.guaranteedPax());
        if (req.avRequirements() != null) beo.setAvRequirements(req.avRequirements());
        if (req.equipmentList() != null) beo.setEquipmentList(req.equipmentList());
        if (req.menuNotes() != null) beo.setMenuNotes(req.menuNotes());
        if (req.dietaryRestrictions() != null) beo.setDietaryRestrictions(req.dietaryRestrictions());
        if (req.serviceTimings() != null) beo.setServiceTimings(req.serviceTimings());
        if (req.beverageNotes() != null) beo.setBeverageNotes(req.beverageNotes());
        if (req.banquetStaffCount() != null) beo.setBanquetStaffCount(req.banquetStaffCount());
        if (req.kitchenNotes() != null) beo.setKitchenNotes(req.kitchenNotes());
        if (req.housekeepingNotes() != null) beo.setHousekeepingNotes(req.housekeepingNotes());
        if (req.maintenanceNotes() != null) beo.setMaintenanceNotes(req.maintenanceNotes());
        if (req.securityNotes() != null) beo.setSecurityNotes(req.securityNotes());
        if (req.financeNotes() != null) beo.setFinanceNotes(req.financeNotes());
        if (req.depositConfirmed() != null) beo.setDepositConfirmed(req.depositConfirmed());
        if (req.internalNotes() != null) beo.setInternalNotes(req.internalNotes());
        beo.setLastUpdatedBy(tenantAccessService.currentUser().getUsername());
        return toBeoResponse(beoRepository.save(beo));
    }

    @Transactional
    public EventOpsDtos.BeoResponse transition(
            UUID hotelId, String hotelHeader, UUID groupId, UUID eventId, BanquetEventOrderStatus newStatus) {
        BanquetEventOrder beo = loadBeo(hotelId, hotelHeader, groupId, eventId);
        BanquetEventOrderStatus current = beo.getStatus();
        boolean valid = switch (current) {
            case DRAFT -> newStatus == BanquetEventOrderStatus.DISTRIBUTED;
            case DISTRIBUTED -> newStatus == BanquetEventOrderStatus.REVISED
                    || newStatus == BanquetEventOrderStatus.LOCKED;
            case REVISED -> newStatus == BanquetEventOrderStatus.DISTRIBUTED;
            case LOCKED -> newStatus == BanquetEventOrderStatus.COMPLETED;
            case COMPLETED -> false;
        };
        if (!valid) {
            throw new ApiException(
                    HttpStatus.CONFLICT, "Invalid BEO transition from " + current + " to " + newStatus);
        }
        beo.setStatus(newStatus);
        if (newStatus == BanquetEventOrderStatus.DISTRIBUTED) {
            beo.setDistributedAt(Instant.now());
        }
        if (newStatus == BanquetEventOrderStatus.LOCKED) {
            beo.setLockedAt(Instant.now());
        }
        beo.setLastUpdatedBy(tenantAccessService.currentUser().getUsername());
        return toBeoResponse(beoRepository.save(beo));
    }

    @Transactional(readOnly = true)
    public EventOpsDtos.BeoResponse getBeo(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        return toBeoResponse(loadBeo(hotelId, hotelHeader, groupId, eventId));
    }

    @Transactional(readOnly = true)
    public EventOpsDtos.FullBeoResponse getFullBEO(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        EventBooking event = assertEvent(hotelId, hotelHeader, groupId, eventId);
        BanquetEventOrder beo = loadBeo(hotelId, hotelHeader, groupId, eventId);
        EventQuote quote = quoteRepository.findByEventBooking_Id(eventId).orElse(null);
        return new EventOpsDtos.FullBeoResponse(
                toBeoResponse(beo),
                toEventResponse(event),
                event.getGroupBooking().getGroupName(),
                event.getGroupBooking().getContactPerson(),
                event.getGroupBooking().getContactEmail(),
                event.getGroupBooking().getContactPhone(),
                cateringLineRepository.findByEventBooking_IdOrderByCreatedAtAsc(eventId).stream()
                        .map(cl -> new EventOpsDtos.CateringLineResponse(
                                cl.getId(),
                                cl.getCateringPackage() != null ? cl.getCateringPackage().getId() : null,
                                cl.getCateringPackage() != null ? cl.getCateringPackage().getPackageName() : null,
                                cl.getDepotProduct() != null ? cl.getDepotProduct().getId() : null,
                                cl.getDepotProduct() != null ? cl.getDepotProduct().getProductCode() : null,
                                cl.getDescription(),
                                cl.getQuantity(),
                                cl.getUnitPrice(),
                                cl.getLineTotal(),
                                cl.isTaxable()))
                        .toList(),
                quote != null ? eventQuoteService.getQuote(hotelId, hotelHeader, groupId, eventId) : null);
    }

    private BanquetEventOrder loadBeo(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        assertEvent(hotelId, hotelHeader, groupId, eventId);
        return beoRepository
                .findByEventAndScope(eventId, hotelId, groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BEO not found"));
    }

    private EventBooking assertEvent(UUID hotelId, String hotelHeader, UUID groupId, UUID eventId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return eventBookingRepository
                .findByIdAndHotel_IdAndGroupBooking_Id(eventId, hotelId, groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event not found"));
    }

    private void copyFromEvent(BanquetEventOrder beo, EventBooking event) {
        beo.setSetupStyle(event.getSetupStyle());
        beo.setExpectedPax(event.getExpectedPax());
        beo.setGuaranteedPax(event.getGuaranteedPax());
        beo.setInternalNotes(event.getCoordinatorNotes());
    }

    private String buildMenuSnapshot(List<EventCateringLine> lines) {
        if (lines.isEmpty()) return null;
        StringBuilder sb = new StringBuilder("Catering snapshot at BEO generation:\n");
        for (EventCateringLine line : lines) {
            sb.append("- ")
                    .append(line.getDescription())
                    .append(" x")
                    .append(line.getQuantity())
                    .append(" @ ")
                    .append(line.getUnitPrice())
                    .append("\n");
        }
        return sb.toString();
    }

    private String buildKitchenNotes(List<EventCateringLine> lines, EventBooking event) {
        StringBuilder sb = new StringBuilder();
        sb.append("Function: ").append(event.getEventName()).append("\n");
        sb.append("Service: ")
                .append(event.getStartDatetime())
                .append(" → ")
                .append(event.getEndDatetime())
                .append("\n");
        Integer covers = event.getGuaranteedPax() != null ? event.getGuaranteedPax() : event.getExpectedPax();
        if (covers != null) {
            sb.append("Covers: ").append(covers).append("\n");
        }
        if (lines.isEmpty()) {
            sb.append("\nNo catering lines on the quote — add items on Catering & quote, then revise this banquet order.");
            return sb.toString();
        }
        sb.append("\nPrepare:\n");
        for (EventCateringLine line : lines) {
            sb.append("- ")
                    .append(line.getDescription())
                    .append(" × ")
                    .append(line.getQuantity())
                    .append(" @ ")
                    .append(line.getUnitPrice())
                    .append("\n");
        }
        return sb.toString().trim();
    }

    private String buildHousekeepingNotes(EventBooking event) {
        StringBuilder sb = new StringBuilder();
        sb.append("Venue: ").append(resolveVenueLabel(event)).append("\n");
        if (event.getSetupStyle() != null && !event.getSetupStyle().isBlank()) {
            sb.append("Setup: ").append(event.getSetupStyle().trim()).append("\n");
        }
        Integer covers = event.getGuaranteedPax() != null ? event.getGuaranteedPax() : event.getExpectedPax();
        if (covers != null) {
            sb.append("Guests: ").append(covers).append("\n");
        }
        if (event.getCoordinatorNotes() != null && !event.getCoordinatorNotes().isBlank()) {
            sb.append("\nCoordinator:\n").append(event.getCoordinatorNotes().trim());
        } else {
            sb.append("\nAdd room setup, linen, and turnover notes before printing.");
        }
        return sb.toString().trim();
    }

    private String resolveVenueLabel(EventBooking event) {
        UUID venueId = event.getVenueOrFacilityId();
        if (venueId == null) {
            return "TBD";
        }
        return facilityRepository
                .findByIdAndHotel_Id(venueId, event.getHotel().getId())
                .map(f -> f.getName())
                .orElse("Facility " + venueId);
    }

    private EventOpsDtos.BeoResponse toBeoResponse(BanquetEventOrder beo) {
        return new EventOpsDtos.BeoResponse(
                beo.getId(),
                beo.getEventBooking().getId(),
                beo.getVersion(),
                beo.getStatus(),
                beo.getDistributedAt(),
                beo.getLockedAt(),
                beo.getAgendaItems(),
                beo.getSetupStyle(),
                beo.getRoomLayoutNotes(),
                beo.getExpectedPax(),
                beo.getGuaranteedPax(),
                beo.getAvRequirements(),
                beo.getEquipmentList(),
                beo.getMenuNotes(),
                beo.getDietaryRestrictions(),
                beo.getServiceTimings(),
                beo.getBeverageNotes(),
                beo.getBanquetStaffCount(),
                beo.getKitchenNotes(),
                beo.getHousekeepingNotes(),
                beo.getMaintenanceNotes(),
                beo.getSecurityNotes(),
                beo.getFinanceNotes(),
                beo.isDepositConfirmed(),
                beo.getInternalNotes(),
                beo.getCreatedBy(),
                beo.getLastUpdatedBy());
    }

    private EventBookingDtos.EventBookingResponse toEventResponse(EventBooking event) {
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
                null,
                event.getCoordinatorNotes());
    }
}
