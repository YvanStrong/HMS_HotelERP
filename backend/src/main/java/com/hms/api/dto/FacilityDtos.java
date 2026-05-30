package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
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
            String invoiceNumber,
            BigDecimal invoiceAmount,
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

    public record FacilityMaintenanceListItem(
            UUID maintenanceId,
            String title,
            String description,
            String priority,
            String status,
            Instant scheduledStart,
            Instant scheduledEnd,
            BigDecimal cost,
            Instant createdAt) {}

    public record ChargeFacilityToRoomRequest(String postedBy) {}

    public record ChargeFacilityToRoomResponse(
            UUID chargeId, UUID reservationId, String description, BigDecimal amount, Instant chargedAt) {}

    public record FacilitySlotCreateRequest(String startTime, String endTime, int maxBookings) {}

    public record FacilitySummary(UUID id, String name, String code, String type) {}

    public record FacilitySlotCalendarItem(
            UUID id,
            Instant start,
            Instant end,
            String status,
            int maxBookings,
            int currentBookings,
            int availableSpots) {}

    public record FacilityBookingListItem(
            UUID bookingId,
            String bookingReference,
            String status,
            String guestName,
            int guestCount,
            Instant slotStart,
            Instant slotEnd,
            String accessCode,
            String invoiceNumber,
            BigDecimal amountPaid) {}

    public record FacilityDashboardResponse(
            UUID facilityId,
            String facilityName,
            LocalDate fromDate,
            LocalDate toDate,
            int totalCapacity,
            int occupiedCount,
            int availableCount,
            List<FacilitySlotCalendarItem> slots,
            List<FacilityBookingListItem> bookings) {}

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

    // ── Abonnements / memberships ─────────────────────────────────────────────

    public record FacilityAbonnementCreateRequest(
            @NotBlank String memberName,
            String companyName,
            String code,
            String contactEmail,
            String contactPhone,
            @NotNull LocalDate validFrom,
            @NotNull LocalDate validUntil,
            Integer visitLimit,
            Boolean monthlyBilling,
            List<UUID> facilityIds) {}

    public record FacilityAbonnementRow(
            UUID id,
            String memberName,
            String companyName,
            String code,
            String contactEmail,
            String contactPhone,
            LocalDate validFrom,
            LocalDate validUntil,
            Integer visitLimit,
            int visitsUsed,
            boolean monthlyBilling,
            boolean active,
            List<FacilitySummary> facilities) {}

    public record FacilityAbonnementCheckInRequest(
            UUID abonnementId,
            String code,
            @NotNull UUID slotId,
            Integer guestCount,
            String staffNotes) {}

    public record FacilityAbonnementCheckInResponse(
            UUID bookingId,
            String bookingReference,
            String status,
            String memberName,
            String code,
            BigDecimal invoiceAmount,
            int visitsUsed,
            Integer visitLimit,
            String billingMode) {}

    public record FacilityInvoiceRow(
            UUID bookingId,
            String invoiceNumber,
            String facilityName,
            String guestName,
            BigDecimal amount,
            Instant invoicedAt) {}

    // ── Water Quality ──────────────────────────────────────────────────────────

    public record WaterQualityLogRequest(
            BigDecimal phLevel,
            BigDecimal freeChlorinePpm,
            BigDecimal combinedChlorinePpm,
            BigDecimal temperatureCelsius,
            BigDecimal turbidityNtu,
            Integer totalDissolvedSolids,
            BigDecimal alkalinityPpm,
            BigDecimal calciumHardnessPpm,
            String notes,
            boolean passedInspection,
            String inspectorName) {}

    public record WaterQualityLogItem(
            UUID id,
            Instant loggedAt,
            String loggedBy,
            BigDecimal phLevel,
            BigDecimal freeChlorinePpm,
            BigDecimal combinedChlorinePpm,
            BigDecimal temperatureCelsius,
            BigDecimal turbidityNtu,
            Integer totalDissolvedSolids,
            BigDecimal alkalinityPpm,
            BigDecimal calciumHardnessPpm,
            String notes,
            boolean passedInspection,
            String inspectorName,
            Instant createdAt) {}

    // ── Lifeguard Roster ───────────────────────────────────────────────────────

    public record LifeguardShiftRequest(
            @NotBlank String staffName,
            String staffEmail,
            String certificationName,
            LocalDate certificationExpiry,
            @NotBlank String shiftDate,
            @NotBlank String shiftStart,
            @NotBlank String shiftEnd,
            String notes) {}

    public record LifeguardShiftItem(
            UUID id,
            String staffName,
            String staffEmail,
            String certificationName,
            LocalDate certificationExpiry,
            LocalDate shiftDate,
            LocalTime shiftStart,
            LocalTime shiftEnd,
            String status,
            String notes,
            boolean certificationExpiringSoon) {}

    // ── Incidents ─────────────────────────────────────────────────────────────

    public record IncidentReportRequest(
            Instant occurredAt,
            @NotBlank String title,
            String description,
            String severity,
            String witnessNames) {}

    public record IncidentResolveRequest(String resolution, @NotBlank String resolvedBy) {}

    public record IncidentItem(
            UUID id,
            Instant occurredAt,
            String title,
            String description,
            String severity,
            String reportedBy,
            String witnessNames,
            String status,
            String resolution,
            Instant resolvedAt,
            String resolvedBy,
            Instant createdAt) {}

    // ── Maintenance completion ─────────────────────────────────────────────────

    public record MaintenanceCompleteRequest(
            String completedBy,
            String inspectorNotes,
            String complianceStatus) {}

    public record MaintenanceCompleteResponse(
            UUID maintenanceId,
            String status,
            String completedBy,
            String complianceStatus,
            Instant completedAt) {}

    // ── Revenue summary ───────────────────────────────────────────────────────

    public record FacilityRevenueSummary(
            UUID facilityId,
            String facilityName,
            LocalDate fromDate,
            LocalDate toDate,
            int totalBookings,
            int checkedInCount,
            BigDecimal totalRevenue,
            BigDecimal roomChargedRevenue,
            BigDecimal directRevenue) {}
}
