package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class GuestDtos {

    private GuestDtos() {}

    public record ApplyPreferencesBlock(Boolean roomAssignment, Boolean amenities, Boolean services) {}

    public record ApplyGuestPreferencesRequest(ApplyPreferencesBlock applyPreferences, Map<String, Object> overrides) {}

    public record ApplyGuestPreferencesResponse(
            UUID reservationId,
            Map<String, Object> appliedPreferences,
            List<Map<String, Object>> alerts,
            List<String> nextSteps) {}

    public record GuestProfileResponse(
            UUID id,
            String name,
            String email,
            Map<String, Object> loyalty,
            Map<String, Object> preferences,
            Map<String, Object> stayHistory,
            Map<String, Object> communication,
            Map<String, Object> flags,
            Map<String, Object> feedback,
            @JsonProperty("operational_complaints") Map<String, Object> operationalComplaints,
            /** Registry: guestType, emergency, corporate, documents, communications, incidents (role-filtered). */
            Map<String, Object> registry) {}

    public record GuestDocumentRow(
            UUID id,
            @JsonProperty("document_type") String documentType,
            @JsonProperty("file_url") String fileUrl,
            @JsonProperty("file_name") String fileName,
            @JsonProperty("expiry_date") LocalDate expiryDate,
            @JsonProperty("created_at") Instant createdAt) {}

    public record GuestDocumentCreateRequest(
            @NotNull @JsonProperty("document_type") String documentType,
            @NotNull @JsonProperty("file_url") String fileUrl,
            @JsonProperty("file_name") String fileName,
            @JsonProperty("expiry_date") LocalDate expiryDate) {}

    public record GuestCommunicationRow(
            UUID id,
            String channel,
            String subject,
            String body,
            UUID reservationId,
            @JsonProperty("created_at") Instant createdAt) {}

    public record GuestCommunicationCreateRequest(
            @NotNull String channel,
            String subject,
            String body,
            UUID reservationId) {}

    public record SensitiveIncidentCreateRequest(
            @NotBlank String incidentType,
            String severity,
            @NotBlank String description,
            String actionTaken) {}

    public record SensitiveIncidentRow(
            UUID id,
            @JsonProperty("incident_type") String incidentType,
            String severity,
            String description,
            @JsonProperty("action_taken") String actionTaken,
            @JsonProperty("reported_at") Instant reportedAt) {}

    public record GuestComplaintCreateRequest(
            String category,
            @NotBlank String description,
            Integer rating,
            UUID reservationId) {}

    public record ComplaintBoardRow(
            UUID id,
            UUID guestId,
            @JsonProperty("guest_name") String guestName,
            String category,
            String comment,
            Integer rating,
            boolean resolved,
            @JsonProperty("resolution_notes") String resolutionNotes,
            @JsonProperty("submitted_at") Instant submittedAt,
            UUID reservationId) {}

    public record LoyaltyReference(String type, String id) {}

    public record LoyaltyEarnRequest(
            long points,
            String type,
            LoyaltyReference reference,
            String description,
            LocalDate expiryDate,
            Boolean notifyGuest) {}

    public record LoyaltyEarnResponse(
            UUID transactionId,
            Map<String, Object> guest,
            Map<String, Object> transaction,
            Map<String, Object> notification) {}

    public record LoyaltyRedeemDetails(Map<String, Object> redemptionDetails) {}

    public record LoyaltyRedeemRequest(
            @NotNull String redemptionType,
            long pointsToRedeem,
            LoyaltyReference reference,
            LoyaltyRedeemDetails redemptionDetails,
            Boolean guestConfirmation) {}

    public record LoyaltyRedeemResponse(
            UUID redemptionId,
            long pointsRedeemed,
            Map<String, Object> guest,
            Map<String, Object> benefit,
            boolean reservationUpdated,
            List<String> notifications) {}

    /** Rwanda-style address for staff reservation / guest search UIs. */
    public record GuestAddressCard(
            String country,
            String province,
            String district,
            String sector,
            String cell,
            String village,
            @JsonProperty("street_number") String streetNumber,
            @JsonProperty("address_notes") String addressNotes) {}

    public record StaffGuestProfileDto(
            UUID id,
            @JsonProperty("full_name") String fullName,
            @JsonProperty("national_id") String nationalId,
            @JsonProperty("date_of_birth") LocalDate dateOfBirth,
            String nationality,
            String gender,
            String email,
            String phone,
            @JsonProperty("phone_country_code") String phoneCountryCode,
            @JsonProperty("id_type") String idType,
            @JsonProperty("id_document_type") String idDocumentType,
            @JsonProperty("id_document_number") String idDocumentNumber,
            @JsonProperty("id_expiry_date") LocalDate idExpiryDate,
            @JsonProperty("vip_level") String vipLevel,
            @JsonProperty("is_blacklisted") boolean blacklisted,
            @JsonProperty("blacklist_reason") String blacklistReason,
            String notes,
            @JsonProperty("marketing_consent") boolean marketingConsent,
            @JsonProperty("guest_type") String guestType,
            @JsonProperty("loyalty_member_number") String loyaltyMemberNumber) {}

    public record StaffReservationRoomDto(
            UUID roomId,
            String roomNumber,
            @JsonProperty("room_status") String roomStatus,
            String cleanliness) {}

    public record ReservationTimelineStep(String phase, Instant at) {}

    /** Present when this reservation is linked to a group / event block. */
    public record StaffReservationGroupSummary(
            UUID id,
            @JsonProperty("group_name") String groupName,
            @JsonProperty("group_code") String groupCode) {}

    public record StaffReservationDetailResponse(
            @JsonProperty("reservation_id") UUID reservationId,
            @JsonProperty("booking_reference") String bookingReference,
            @JsonProperty("confirmation_code") String confirmationCode,
            String status,
            @JsonProperty("booking_source") String bookingSource,
            @JsonProperty("check_in_date") LocalDate checkInDate,
            @JsonProperty("check_out_date") LocalDate checkOutDate,
            int nights,
            StaffGuestProfileDto guest,
            @JsonProperty("guest_address") GuestAddressCard guestAddress,
            StaffReservationRoomDto room,
            List<ReservationTimelineStep> timeline,
            @JsonProperty("folio_api_path") String folioApiPath,
            @JsonProperty("group_booking") StaffReservationGroupSummary groupBooking) {}

    /** Guest search / pre-fill for walk-in booking. */
    public record GuestSearchHit(StaffGuestProfileDto guest, GuestAddressCard address) {}

    public record OperationalComplaintCreateRequest(
            @NotNull UUID guestId,
            @NotNull UUID reservationId,
            @NotBlank String type,
            @NotBlank String severity,
            @NotBlank String description,
            /** Required when severity is CRITICAL. */
            UUID assignedTo) {}

    public record OperationalComplaintPatchRequest(
            String status,
            String severity,
            String type,
            UUID assignedTo,
            @JsonProperty("clear_assignee") Boolean clearAssignee,
            String resolution) {}

    public record OperationalComplaintAssignRequest(@NotNull @JsonProperty("assigned_to") UUID assignedTo) {}

    public record OperationalComplaintRow(
            UUID id,
            UUID guestId,
            String guestName,
            UUID reservationId,
            String bookingReference,
            String type,
            String severity,
            String status,
            UUID assignedTo,
            @JsonProperty("assigned_to_name") String assignedToName,
            String description,
            String resolution,
            @JsonProperty("opened_at") Instant openedAt,
            @JsonProperty("resolved_at") Instant resolvedAt) {}
}
