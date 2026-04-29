package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
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
            Map<String, Object> flags) {}

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
            @JsonProperty("marketing_consent") boolean marketingConsent) {}

    public record StaffReservationRoomDto(
            UUID roomId,
            String roomNumber,
            @JsonProperty("room_status") String roomStatus,
            String cleanliness) {}

    public record ReservationTimelineStep(String phase, Instant at) {}

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
            @JsonProperty("folio_api_path") String folioApiPath) {}

    /** Guest search / pre-fill for walk-in booking. */
    public record GuestSearchHit(StaffGuestProfileDto guest, GuestAddressCard address) {}
}
