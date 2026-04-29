package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class FacilityDtos {

    private FacilityDtos() {}

    public record FacilityGuestRef(UUID id, String firstName, String lastName, String email, String phone) {}

    public record FacilityPaymentInput(String method, BigDecimal amount, String token) {}

    public record FacilityBookingRequest(
            UUID slotId,
            int guestCount,
            UUID reservationId,
            FacilityGuestRef guest,
            String specialRequests,
            boolean chargeToRoom,
            FacilityPaymentInput payment) {}

    public record FacilitySlotInfo(Instant startTime, Instant endTime) {}

    public record FacilityNameSlot(String name, FacilitySlotInfo slot) {}

    public record FacilityAccessDto(String qrCode, String accessCode, String instructions) {}

    public record FacilityChargesDto(
            BigDecimal amount, boolean chargedToRoom, UUID roomChargeId) {}

    public record FacilityCancellationDto(Instant allowedUntil, String cancelEndpoint) {}

    public record FacilityBookingResponse(
            UUID bookingId,
            String bookingReference,
            String status,
            FacilityNameSlot facility,
            int guestCount,
            FacilityAccessDto access,
            FacilityChargesDto charges,
            FacilityCancellationDto cancellation) {}

    public record FacilityCheckInRequest(String accessCode, Integer actualGuestCount, String staffNotes) {}

    public record FacilityOccupancyBroadcast(String event, Map<String, Object> data) {}

    public record FacilityOccupancyInfo(String name, int currentOccupancy, int remainingCapacity) {}

    public record FacilityCheckInResponse(
            UUID bookingId,
            String status,
            Instant checkedInAt,
            FacilityOccupancyInfo facility,
            FacilityOccupancyBroadcast broadcast) {}

    public record FacilityMaintenanceRequest(
            String title,
            String description,
            String priority,
            List<UUID> affectedSlots,
            Instant scheduledStart,
            Integer estimatedDurationMinutes,
            BigDecimal cost) {}

    public record AffectedBookingNotice(
            UUID bookingId, String guestEmail, boolean notificationSent, String alternativeOffered) {}

    public record FacilityPublicNotice(boolean displayAtEntrance, String message) {}

    public record FacilityMaintenanceResponse(
            UUID maintenanceId,
            String status,
            int blockedSlots,
            List<AffectedBookingNotice> affectedBookings,
            FacilityPublicNotice publicNotice) {}

    public record ChargeFacilityToRoomRequest(String postedBy) {}

    public record ChargeFacilityToRoomResponse(
            UUID chargeId, UUID reservationId, String description, BigDecimal amount, Instant chargedAt) {}

    public record FacilitySlotCreateRequest(String startTime, String endTime, int maxBookings) {}

    public record FacilitySummary(UUID id, String name, String code, String type) {}

    public record FacilitySlotResponse(UUID slotId, Instant start, Instant end, int maxBookings, String status) {}

    public record FacilityCreateRequest(
            @NotBlank String name,
            @NotBlank String code,
            String description,
            @NotBlank String type,
            Integer maxCapacity,
            BigDecimal basePrice,
            Boolean requiresAdvanceBooking,
            Boolean allowsWalkIn) {}

    public record FacilityCreatedResponse(UUID id) {}
}
