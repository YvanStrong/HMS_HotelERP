package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ApiDtos {

    private ApiDtos() {}

    /** 1-based {@code page}; includes v2.3-style pagination hints. */
    public record Pagination(int page, int size, long total, int totalPages, boolean hasNext, boolean hasPrevious) {}

    /** v2.3: at least one of {@code username} or {@code email} must be non-blank. */
    public record LoginRequest(String username, String email, @NotBlank String password) {

        @AssertTrue(message = "Either username or email is required")
        public boolean isLoginIdentifierPresent() {
            return (username != null && !username.isBlank()) || (email != null && !email.isBlank());
        }
    }

    public record RefreshTokenRequest(@NotBlank String refreshToken) {}

    public record AuthUserInfo(
            UUID id, String email, String username, String role, UUID hotelId, List<String> permissions) {}

    public record HotelStaffUserRow(UUID id, String username, String email, String role, boolean isActive, Instant createdAt) {}

    public record HotelStaffCreateRequest(
            @NotBlank String username,
            @NotBlank String password,
            @Email String email,
            @NotBlank String role) {}

    public record HotelStaffRoleUpdateRequest(@NotBlank String role) {}

    public record HotelStaffPasswordResetRequest(@NotBlank String newPassword) {}

    public record LoginResponse(
            String accessToken,
            String refreshToken,
            long expiresIn,
            String tokenType,
            AuthUserInfo user) {}

    public record RoomTypeSummary(UUID id, String name, BigDecimal baseRate, Integer maxOccupancy, Integer bedCount) {}

    public record ReservationSummary(
            UUID id,
            String confirmationCode,
            String guestName,
            UUID guestId,
            String status,
            LocalDate checkInDate,
            LocalDate checkOutDate) {}

    public record RoomListItem(
            UUID id,
            String roomNumber,
            Integer floor,
            String building,
            RoomTypeSummary roomType,
            String status,
            String cleanliness,
            boolean isOutOfOrder,
            boolean dnd,
            Instant dndUntil,
            String operationalState,
            Instant lastUpdated,
            ReservationSummary currentReservation,
            boolean hasActiveBlock) {}

    public record RoomDetailResponse(
            UUID id,
            String roomNumber,
            Integer floor,
            String building,
            RoomTypeSummary roomType,
            String status,
            String cleanliness,
            boolean isOutOfOrder,
            boolean dnd,
            Instant dndUntil,
            Instant dndSetAt,
            String operationalState,
            String maintenanceNotes,
            List<String> amenitiesOverride,
            Instant lastUpdated,
            ReservationSummary currentReservation,
            UUID activeRoomBlockId) {}

    public record DeleteRoomResponse(UUID id, String message) {}

    public record PagedData<T>(List<T> data, Pagination pagination) {}

    public record CreateRoomRequest(
            @NotBlank String roomNumber,
            Integer floor,
            String building,
            UUID roomTypeId,
            String roomTypeCode,
            String initialStatus,
            List<String> amenitiesOverride) {}

    public record CreateRoomResponse(
            UUID id,
            String roomNumber,
            Integer floor,
            String building,
            RoomTypeSummary roomType,
            String status,
            String cleanliness,
            boolean isOutOfOrder,
            List<String> amenities,
            Instant createdAt,
            String createdBy,
            String message) {}

    public record PatchRoomRequest(
            String status,
            String cleanliness,
            String maintenanceNotes,
            Boolean isOutOfOrder,
            String building,
            Integer floor) {}

    public record RoomLifecycleSnapshot(
            String status,
            String cleanliness,
            Boolean isOutOfOrder,
            String maintenanceNotes,
            Integer floor,
            String building) {}

    public record RoomUpdateBroadcast(String event, String channel, Map<String, Object> payload) {}

    public record PatchRoomResponse(
            UUID id,
            String roomNumber,
            RoomLifecycleSnapshot previousValues,
            RoomLifecycleSnapshot updatedValues,
            Instant updatedAt,
            String updatedBy,
            RoomUpdateBroadcast broadcast) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GuestInput(
            String firstName,
            String lastName,
            String email,
            String phone,
            IdDocumentInput idDocument,
            String fullName,
            @JsonProperty("national_id") String nationalId,
            @JsonProperty("date_of_birth") LocalDate dateOfBirth,
            String nationality,
            String gender,
            @JsonProperty("phone_country_code") String phoneCountryCode,
            String country,
            String province,
            String district,
            String sector,
            String cell,
            String village,
            @JsonProperty("street_number") String streetNumber,
            @JsonProperty("address_notes") String addressNotes,
            @JsonProperty("id_type") String idType,
            @JsonProperty("id_expiry_date") LocalDate idExpiryDate,
            @JsonProperty("vip_level") String vipLevel,
            @JsonProperty("marketing_consent") Boolean marketingConsent,
            String notes,
            @JsonProperty("is_blacklisted") Boolean isBlacklisted,
            @JsonProperty("blacklist_reason") String blacklistReason) {}

    public record IdDocumentInput(String type, String number) {}

    public record RatePlanInput(
            BigDecimal nightlyRate, Boolean includesBreakfast, String cancellationPolicy) {}

    public record PaymentInput(Boolean depositRequired, BigDecimal depositAmount, String paymentMethod) {}

    public record CreateReservationRequest(
            UUID guestId,
            GuestInput guest,
            UUID roomTypeId,
            String roomTypeCode,
            UUID preferredRoomId,
            LocalDate checkInDate,
            LocalDate checkOutDate,
            Integer adults,
            Integer children,
            String specialRequests,
            String source,
            RatePlanInput ratePlan,
            PaymentInput payment) {}

    public record GuestBrief(UUID id, String name, String email) {}

    public record ReservationStayDates(LocalDate checkIn, LocalDate checkOut, int nights) {}

    public record ReservationPricingSummary(
            BigDecimal nightlyRate,
            BigDecimal roomSubtotal,
            BigDecimal estimatedTaxes,
            BigDecimal estimatedFees,
            BigDecimal depositPaid,
            BigDecimal balanceDue) {}

    public record CancellationHint(String policyCode, String policySummary, String cancelEndpointHint) {}

    public record CreateReservationResponse(
            UUID id,
            String confirmationCode,
            @JsonProperty("booking_reference") String bookingReference,
            String status,
            UUID guestId,
            GuestBrief guest,
            RoomAssign room,
            ReservationStayDates stay,
            ReservationPricingSummary pricing,
            CancellationHint cancellation,
            List<String> nextSteps,
            String message) {}

    public record RoomAssign(UUID id, String roomNumber, Integer floor) {}

    public record AvailabilityRoom(UUID roomId, String roomNumber, Integer floor, BigDecimal rate) {}

    public record AltDate(LocalDate checkIn, boolean available) {}

    public record Pricing(BigDecimal baseRate, BigDecimal taxes, BigDecimal fees, BigDecimal totalPerNight) {}

    public record AvailabilityResponse(
            boolean available,
            List<AvailabilityRoom> availableRooms,
            List<AltDate> alternativeDates,
            Pricing pricing,
            /** Staff / UX hint when {@code available} is false (may be null). */
            String availabilityHint) {}

    public record IdVerificationInput(
            String documentType, String documentNumber, String photoUrl, String verifiedBy) {}

    public record PaymentMethodInput(String type, String last4, String brand, String token) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CheckInRequest(
            Instant actualCheckInTime,
            @JsonProperty("room_id") @JsonAlias("assignedRoomId") UUID assignedRoomId,
            IdVerificationInput idVerification,
            @JsonProperty("guest_id_verified") Boolean guestIdVerified,
            @JsonProperty("is_early_checkin") Boolean isEarlyCheckin,
            PaymentMethodInput paymentMethod,
            String specialInstructions) {}

    public record DigitalKey(boolean enabled, String keyCode, Instant validFrom, Instant validUntil) {}

    public record CheckInGuestInfo(String name, boolean idVerified, Instant verificationTimestamp) {}

    public record CheckInPaymentInfo(String method, String last4, String brand, String authorizationCode, BigDecimal preAuthAmount) {}

    public record FolioOpenedInfo(String folioRef, String viewPathTemplate, BigDecimal openingBalancePreTax) {}

    public record CheckInBroadcastInfo(String event, List<String> channels, Map<String, Object> payload) {}

    public record CheckInResponse(
            UUID reservationId,
            String status,
            RoomStatusDto room,
            CheckInGuestInfo guest,
            CheckInPaymentInfo payment,
            DigitalKey digitalKey,
            FolioOpenedInfo folio,
            CheckInBroadcastInfo broadcast,
            List<String> nextSteps) {}

    public record RoomStatusDto(UUID id, String roomNumber, String status, String cleanliness) {}

    public record FinalPaymentInput(String method, BigDecimal amount, String transactionId) {}

    public record FeedbackInput(Integer rating, String comment) {}

    public record PostCheckoutInput(Boolean sendInvoiceEmail, Boolean addToLoyaltyProgram, String scheduleFollowUp) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CheckOutRequest(
            Instant actualCheckOutTime,
            FinalPaymentInput finalPayment,
            FeedbackInput feedback,
            PostCheckoutInput postCheckout,
            @JsonProperty("minibar_inspected") Boolean minibarInspected,
            @JsonProperty("is_late_checkout") Boolean isLateCheckout,
            @JsonProperty("override_balance_warning") Boolean overrideBalanceWarning) {}

    public record InvoiceLine(String description, BigDecimal amount) {}

    public record InvoiceDto(
            UUID id, String invoiceNumber, BigDecimal totalAmount, String pdfUrl, List<InvoiceLine> items) {}

    public record InvoiceBreakdown(
            BigDecimal roomCharges,
            BigDecimal consumptionCharges,
            BigDecimal subtotalBeforeTax,
            BigDecimal taxes,
            BigDecimal depositCredit,
            BigDecimal grandTotal) {}

    public record FeedbackEcho(Integer rating, String comment) {}

    public record PostCheckoutEcho(Boolean sendInvoiceEmail, Boolean addToLoyaltyProgram, String scheduleFollowUp) {}

    public record CheckOutResponse(
            UUID reservationId,
            String status,
            RoomStatusDto room,
            InvoiceDto invoice,
            InvoiceBreakdown invoiceBreakdown,
            FeedbackEcho feedback,
            PostCheckoutEcho postCheckout,
            Integer loyaltyPointsEarned,
            String message) {}

    public record CancelReservationRequest(String reason) {}

    public record CancelReservationResponse(UUID reservationId, String status, String message) {}

    public record NoShowResponse(UUID reservationId, String status, String message) {}

    public record HotelFeePolicy(
            BigDecimal earlyCheckinFee, BigDecimal lateCheckoutFee, BigDecimal noShowDefaultFee, String currency) {}

    public record HousekeepingPatchRequest(
            String status,
            String cleanliness,
            String notes,
            InspectionInput inspection,
            String reason) {}

    public record InspectionInput(String inspectorId, List<String> photos, Integer qualityScore) {}

    public record HousekeepingPatchResponse(
            UUID roomId,
            String previousStatus,
            String newStatus,
            Instant updatedAt,
            String broadcast) {}

    public record PostChargeRequest(
            @NotNull UUID reservationId,
            @NotBlank String description,
            @NotNull BigDecimal amount,
            @NotBlank String type,
            Integer quantity,
            String postedBy,
            Map<String, Object> metadata) {}

    public record PostChargePostedBy(String username, String displayName) {}

    public record PostChargeFolioSnapshot(BigDecimal previousTotalPreTax, BigDecimal newBalancePreTax) {}

    public record PostChargeResponse(
            UUID chargeId,
            UUID reservationId,
            String roomNumber,
            String description,
            BigDecimal amount,
            Integer quantity,
            String type,
            PostChargePostedBy postedBy,
            PostChargeFolioSnapshot folio,
            BigDecimal runningTotal,
            Instant postedAt,
            Map<String, Object> inventoryImpact) {}

    public record ReservationChargePostRequest(
            @NotBlank @JsonProperty("charge_type") String chargeType,
            @NotBlank String description,
            @NotNull BigDecimal amount,
            String currency) {}

    public record FolioCharge(
            UUID id,
            Instant date,
            String description,
            BigDecimal amount,
            String type,
            Integer quantity,
            String postedBy,
            boolean reversible,
            String productSku) {}

    public record FolioSummary(
            @JsonProperty("reservation_id") UUID reservationId,
            @JsonProperty("room_charges_total") BigDecimal roomChargesTotal,
            @JsonProperty("other_charges_total") BigDecimal otherChargesTotal,
            @JsonProperty("gross_total") BigDecimal grossTotal,
            @JsonProperty("tax_total") BigDecimal taxTotal,
            @JsonProperty("discount_total") BigDecimal discountTotal,
            @JsonProperty("grand_total") BigDecimal grandTotal,
            @JsonProperty("payments_total") BigDecimal paymentsTotal,
            @JsonProperty("balance_due") BigDecimal balanceDue,
            String currency) {}

    public record FolioGuestBlock(UUID id, String name, String email) {}

    public record FolioStayBlock(
            LocalDate checkIn, LocalDate checkOut, String reservationStatus, int totalNights, int nightsElapsedOrBooked) {}

    public record FolioPaymentLine(
            UUID id,
            Instant postedAt,
            String method,
            String last4,
            BigDecimal amount,
            String type,
            String status,
            String reference,
            String notes) {}

    public record PaymentCreateRequest(
            @NotBlank @JsonProperty("payment_type") String paymentType,
            @NotBlank String method,
            @NotNull BigDecimal amount,
            @NotBlank String currency,
            String reference,
            String notes) {}

    public record PaymentVoidRequest(@NotBlank String reason) {}

    public record FolioRealtimeHint(String channelTemplate, String note) {}

    public record FolioResponse(
            UUID reservationId,
            UUID hotelId,
            String confirmationCode,
            @JsonProperty("booking_reference") String bookingReference,
            FolioGuestBlock guest,
            FolioStayBlock stay,
            UUID roomId,
            String roomNumber,
            String roomTypeName,
            List<FolioCharge> charges,
            List<FolioPaymentLine> payments,
            FolioSummary summary,
            List<String> actions,
            FolioRealtimeHint realtime) {}

    public record NightAuditRunResponse(
            @JsonProperty("run_date") LocalDate runDate,
            @JsonProperty("rooms_audited") int roomsAudited,
            @JsonProperty("charges_posted") int chargesPosted,
            @JsonProperty("total_amount") BigDecimal totalAmount,
            String status,
            String errors,
            @JsonProperty("run_at") Instant runAt,
            @JsonProperty("run_by") String runBy) {}

    public record HousekeepingTask(
            UUID roomId,
            String roomNumber,
            String priority,
            String currentStatus,
            List<String> requiredActions,
            int estimatedTime,
            UUID assignedTo) {}

    public record HousekeepingRestockTaskDto(
            UUID id,
            UUID roomId,
            String roomNumber,
            String sku,
            String itemName,
            BigDecimal quantitySuggested,
            String status) {}

    public record HousekeepingTasksResponse(
            List<HousekeepingTask> tasks,
            HousekeepingSummary summary,
            List<HousekeepingRestockTaskDto> minibarRestockTasks) {}

    public record HousekeepingSummary(int totalDirty, int inProgress, int readyForInspection, int skippedDueToDnd) {}

    public record HousekeepingBoardTask(
            UUID id,
            String roomNumber,
            String taskType,
            String status,
            String priority,
            UUID assignedTo,
            String assignedToName,
            Instant createdAt,
            String notes,
            @JsonProperty("room_dnd") Boolean roomDnd,
            @JsonProperty("room_dnd_until") Instant roomDndUntil) {}

    public record HousekeepingBoardResponse(
            List<HousekeepingBoardTask> pending,
            List<HousekeepingBoardTask> inProgress,
            List<HousekeepingBoardTask> completed,
            List<HousekeepingBoardTask> inspected) {}

    public record HousekeepingStaffOption(UUID id, String username, String role) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HousekeepingTaskCreateRequest(
            @NotNull @JsonProperty("room_id") UUID roomId,
            @JsonProperty("booking_id") UUID bookingId,
            @NotBlank @JsonProperty("task_type") String taskType,
            @NotBlank String priority,
            String notes) {}

    public record HousekeepingAssignRequest(@NotNull @JsonProperty("assigned_to") UUID assignedTo) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HousekeepingCompleteRequest(String notes, @JsonProperty("photo_url") String photoUrl, @JsonProperty("checklist_completed") Boolean checklistCompleted) {}

    public record HousekeepingInspectRequest(@NotNull Integer score) {}

    public record HotelCreateInput(
            @NotBlank String name,
            String code,
            String timezone,
            String currency,
            String subscriptionStatus,
            String description,
            String address,
            String phone,
            String email,
            String imageUrl,
            String logoUrl,
            Integer starRating,
            Boolean isActive,
            /** When set with {@code adminPassword}, a hotel-scoped admin user is created in the same transaction. */
            String adminUsername,
            String adminPassword) {}

    /** Platform hotel update (partial). */
    public record HotelUpdateInput(
            String name,
            String code,
            String description,
            String currency,
            String timezone,
            String address,
            String phone,
            String email,
            String imageUrl,
            String logoUrl,
            Integer starRating,
            Boolean isActive) {}

    public record BootstrapUserInput(@NotBlank String username, @NotBlank String password, String email) {}

    public record RoomTypeCreateInput(
            @NotBlank String code,
            @NotBlank String name,
            String description,
            @NotNull Integer maxOccupancy,
            @NotNull Integer bedCount,
            @NotNull BigDecimal baseRate,
            List<String> amenities) {}

    public record RoomTypeUpdateInput(
            @NotBlank String code,
            @NotBlank String name,
            String description,
            @NotNull Integer maxOccupancy,
            @NotNull Integer bedCount,
            @NotNull BigDecimal baseRate,
            List<String> amenities) {}

    public record BootstrapRoomInput(
            @NotBlank String roomNumber,
            @NotBlank String roomTypeCode,
            Integer floor,
            String building,
            String initialStatus) {}

    public record SetupInitializeRequest(
            @NotNull @Valid HotelCreateInput hotel,
            @NotNull @Valid BootstrapUserInput superAdmin,
            BootstrapUserInput hotelAdmin,
            List<RoomTypeCreateInput> roomTypes,
            List<BootstrapRoomInput> rooms) {}

    public record SetupInitializeResponse(
            UUID hotelId, String message, int roomTypesCreated, int roomsCreated) {}

    public record CreateHotelResponse(UUID id, String code, String name, String message) {}

    public record CreateRoomTypeResponse(UUID id, String code, String name, String message) {}

    public record DeleteRoomTypeResponse(UUID id, String message) {}

    /** Room Management module — live dashboard buckets (spec §2). */
    public record RoomDashboardResponse(
            UUID hotelId,
            Map<String, Long> bucketCounts,
            int totalRooms,
            Instant generatedAt,
            List<DndStaleRoom> staleDndRooms) {}

    public record DndStaleRoom(UUID roomId, String roomNumber, Instant dndSetAt) {}

    /** Headline counts for the room grid (Phase 1 Step 2). */
    public record RoomStatusSummary(long total, long occupied, long vacantClean, long vacantDirty, long outOfOrder) {}

    public record RoomStatusLogEntry(
            UUID id,
            String previousStatus,
            String newStatus,
            String previousCleanliness,
            String newCleanliness,
            String actor,
            UUID changedByUserId,
            String reason,
            Instant createdAt) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RoomDndPatchRequest(
            @JsonAlias("is_dnd") Boolean isDnd,
            @JsonAlias("expires_at") String expiresAt,
            Boolean enabled,
            String dndUntil) {}

    public record RoomDndResponse(
            UUID roomId,
            boolean dnd,
            Instant dndUntil,
            boolean previousDnd,
            Instant previousDndUntil,
            Instant updatedAt) {}

    public record RoomBlockCreateRequest(
            @NotNull UUID roomId,
            @NotBlank String blockType,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            String notes) {}

    /** Per-room operational hold (Phase 1 Step 5). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RoomOperationalBlockRequest(
            @NotBlank @JsonProperty("block_type") String blockType,
            @NotBlank String reason,
            @NotNull @JsonProperty("blocked_from") Instant blockedFrom,
            @NotNull @JsonProperty("blocked_until") Instant blockedUntil,
            @JsonProperty("auto_release") Boolean autoRelease) {

        public boolean autoReleaseFlag() {
            return Boolean.TRUE.equals(autoRelease);
        }
    }

    public record RoomBlockResponse(
            UUID id,
            UUID roomId,
            String roomNumber,
            String blockType,
            LocalDate startDate,
            LocalDate endDate,
            String notes,
            String createdBy,
            Instant createdAt,
            Instant releasedAt) {}

    public record RoomTypeNightlyRateEntry(@NotNull LocalDate rateDate, @NotNull BigDecimal nightlyRate) {}

    public record RoomTypeNightlyRatesUpsertRequest(@NotNull @NotEmpty List<RoomTypeNightlyRateEntry> rates) {}

    public record RoomTypeNightlyRatesUpsertResponse(UUID roomTypeId, int upsertedCount, String message) {}

    public record RoomDailyOccupancyRow(LocalDate date, long occupiedRooms, long totalRooms) {}

    public record RoomOccupancyGridResponse(UUID hotelId, List<RoomDailyOccupancyRow> days) {}

    /** Ranked rooms for manual reassignment / check-in (spec §2 automated assignment — heuristic). */
    public record AssignmentSuggestionRoom(
            UUID roomId, String roomNumber, Integer floor, int score, String reasonSummary) {}

    /** Public marketing catalog — no sensitive fields. */
    public record PublicHotelCatalogItem(
            UUID id,
            String name,
            String code,
            String currency,
            String timezone,
            String description,
            String address,
            String phone,
            String email,
            String imageUrl,
            String logoUrl,
            Integer starRating,
            boolean isActive) {}

    /** Staff reservation board row. */
    public record ReservationListItem(
            UUID id,
            String confirmationCode,
            @JsonProperty("booking_reference") String bookingReference,
            String status,
            LocalDate checkInDate,
            LocalDate checkOutDate,
            int nights,
            String guestName,
            @JsonProperty("guest_national_id_masked") String guestNationalIdMasked,
            String guestEmail,
            String roomNumber,
            BigDecimal totalAmount,
            String currency,
            @JsonProperty("booking_source") String bookingSource,
            Instant createdAt,
            boolean portalBooking,
            UUID guestId) {}

    public record RoomTypeAvailabilityItem(
            @JsonProperty("room_type_id") UUID roomTypeId,
            String name,
            @JsonProperty("base_price_per_night") BigDecimal basePricePerNight,
            @JsonProperty("total_price") BigDecimal totalPrice,
            String currency,
            int nights,
            @JsonProperty("available_count") int availableCount,
            List<String> amenities,
            List<String> images) {}

    public record RoomTypesAvailabilityResponse(
            @JsonProperty("available_room_types") List<RoomTypeAvailabilityItem> availableRoomTypes) {}

    /** Guest self-service lookup — redacted (no folio line items). */
    public record PublicReservationLookupResponse(
            String confirmationCode,
            String status,
            LocalDate checkInDate,
            LocalDate checkOutDate,
            String roomTypeName,
            String hotelName,
            BigDecimal balanceDue,
            String currency) {}

    /** Public room type with marketing copy and included amenities / services. */
    public record PublicRoomTypeCatalogItem(
            UUID id,
            String code,
            String name,
            String description,
            BigDecimal baseRate,
            Integer maxOccupancy,
            Integer bedCount,
            List<String> amenities) {}

    /** Assignable room visible on the marketing site with merged type + room-level inclusions. */
    public record PublicRoomOffer(
            UUID roomId,
            String roomNumber,
            Integer floor,
            UUID roomTypeId,
            String roomTypeName,
            BigDecimal indicativeNightlyFrom,
            List<String> includedFeatures) {}

    public record RegisterGuestRequest(
            @NotNull UUID hotelId,
            @NotBlank @Email String email,
            @NotBlank String password,
            @NotBlank String firstName,
            @NotBlank String lastName,
            String phone) {}

    /** Logged-in guest: trips at one property (scope by hotel). */
    public record GuestBookingRow(
            UUID reservationId,
            String confirmationCode,
            String hotelName,
            String status,
            LocalDate checkInDate,
            LocalDate checkOutDate,
            String roomNumber,
            String roomTypeName,
            boolean includesBreakfast,
            String cancellationPolicy,
            String specialRequests,
            String standardArrivalMessage,
            List<String> servicesIncluded,
            BigDecimal totalAmount,
            String currency) {}
}
