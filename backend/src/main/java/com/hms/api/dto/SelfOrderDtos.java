package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class SelfOrderDtos {

    private SelfOrderDtos() {}

    public record PublicDepotBrief(UUID id, String name) {}

    public record PublicMenuItem(
            UUID id,
            UUID depotId,
            String depotName,
            String productName,
            String productCode,
            BigDecimal sellingPrice,
            String photoUrl,
            String menuName,
            String stockType,
            BigDecimal stockQty,
            boolean active) {}

    /**
     * {@code orderBoardKeyConfigured} means the TV board URL must include {@code ?key=…}. {@code hotelName} is used
     * for guest-facing branding (e.g. table QR menus).
     */
    public record PublicMenuResponse(
            String currency,
            boolean orderBoardKeyConfigured,
            List<PublicDepotBrief> depots,
            List<PublicMenuItem> items,
            String hotelName,
            /** Tenant toggle: allow SMS on READY when globally configured. */
            boolean selfOrderSmsEnabled,
            /** Tenant toggle: allow Web Push when globally configured. */
            boolean selfOrderPushEnabled) {}

    /** Aggregates for the public self-order “operations” tab (kiosk / QR demo). */
    public record PublicActiveOrderBrief(String displayCode, String status, String lineSummary, String pickupDisplayName) {}

    public record PublicPortalSummary(
            long todayOrderCount,
            BigDecimal todayRevenueTotal,
            Integer avgFulfillmentMinutes,
            List<PublicActiveOrderBrief> activeOrders) {}

    public record CreateLineInput(
            @NotNull UUID productId,
            @NotNull BigDecimal quantity,
            /** Optional per-line note: modifiers, allergens, prep instructions. */
            String modifiersNote) {}

    public record RoomChargeVerification(
            @NotBlank String roomNumber,
            /** Confirmation code or booking reference (e.g. HMS-2026-…), case-insensitive. */
            @NotBlank String bookingCode) {}

    /**
     * {@code paymentMode}: {@code SIMULATED} (default) — paid immediately; {@code PAY_AT_COUNTER} — staff confirms;
     * {@code CHARGE_ROOM} — post total to checked-in guest folio (requires {@code roomCharge}).
     *
     * <p>{@code depotId} is optional when every line belongs to the same depot (inferred). When the cart spans
     * multiple outlets, omit {@code depotId} and the server creates one ticket per outlet in a single transaction.
     */
    public record CreatePublicOrderRequest(
            @NotNull String serviceType,
            UUID depotId,
            @NotEmpty List<CreateLineInput> lines,
            String customerNote,
            String paymentMode,
            @JsonProperty("room_charge") RoomChargeVerification roomCharge,
            /** Call-out name for counter / KDS (optional). */
            @JsonProperty("pickup_display_name") @Size(max = 64) String pickupDisplayName,
            /** Table, seat, or area (optional). */
            @JsonProperty("pickup_location") @Size(max = 48) String pickupLocation,
            /** E.164-style mobile for SMS when order becomes READY (optional). */
            @JsonProperty("sms_notify_phone") @Size(max = 24) String smsNotifyPhone,
            /** Required true when {@code sms_notify_phone} is set (transactional SMS consent). */
            @JsonProperty("sms_consent_accepted") Boolean smsConsentAccepted,
            @JsonProperty("sms_consent_version") @Size(max = 16) String smsConsentVersion) {}

    /** Additional outlet tickets from the same checkout (empty when a single outlet order). */
    public record PlacedOrderRef(UUID trackToken, String displayCode, String orderNumber, String depotName) {}

    public record CreatePublicOrderResponse(
            UUID orderId,
            String orderNumber,
            String displayCode,
            UUID trackToken,
            String serviceType,
            String status,
            String paymentStatus,
            String paymentMethod,
            BigDecimal totalAmount,
            Instant createdAt,
            String message,
            List<PlacedOrderRef> siblingOrders,
            String pickupDisplayName,
            String pickupLocation) {}

    public record TrackLineRow(
            String productName,
            String productCode,
            BigDecimal quantity,
            BigDecimal lineTotal,
            String modifiersNote,
            String photoUrl) {}

    public record TrackOrderResponse(
            UUID orderId,
            String orderNumber,
            String displayCode,
            String serviceType,
            String status,
            String paymentStatus,
            String paymentMethod,
            String depotName,
            BigDecimal totalAmount,
            Instant createdAt,
            Instant updatedAt,
            String customerNote,
            String pickupDisplayName,
            String pickupLocation,
            List<TrackLineRow> lines) {}

    public record BoardLineBrief(String productName, BigDecimal quantity, String modifiersNote, String photoUrl) {}

    public record BoardOrderCard(
            UUID orderId,
            String displayCode,
            String serviceType,
            String status,
            String depotName,
            Instant createdAt,
            String pickupDisplayName,
            String pickupLocation,
            List<BoardLineBrief> lines) {}

    public record BoardResponse(List<BoardOrderCard> orders) {}

    public record StaffOrderRow(
            UUID orderId,
            String orderNumber,
            String displayCode,
            String serviceType,
            String status,
            String paymentStatus,
            String paymentMethod,
            String depotName,
            BigDecimal totalAmount,
            Instant createdAt,
            Instant updatedAt,
            String pickupDisplayName,
            String pickupLocation,
            Instant lastNotifyAt,
            String lastNotifyStatus,
            String lastNotifyDetail,
            List<TrackLineRow> lines) {}

    /** Rolling “today” (hotel timezone) operational counts from {@code self_order_events}. */
    public record SelfOrderHealthSnapshot(
            Instant windowStartUtc,
            long totalEvents,
            long ordersPlaced,
            long notifySmsOk,
            long notifySmsFail,
            long notifyPushOk,
            long notifyPushFail) {}

    public record WebPushPublicConfigResponse(boolean configured, String publicKey, String subject) {}

    public record WebPushSubscribeRequest(
            @NotNull UUID trackToken,
            @NotBlank String endpoint,
            @NotBlank String p256dh,
            @NotBlank String auth) {}

    public record PatchOrderStatusRequest(@NotNull String status) {}

    /**
     * {@code orderBoardSecretEcho} is always null on GET. On PUT it echoes the new secret when one was saved (for QR
     * setup); null when the key was cleared.
     */
    public record StaffSelfOrderSettings(
            boolean orderBoardKeyConfigured,
            String orderBoardSecretEcho,
            /** When true, public pickup board hides guest names; kitchen board still shows them. */
            boolean pickupBoardHideGuestNames,
            boolean selfOrderSmsEnabled,
            boolean selfOrderPushEnabled) {}

    /**
     * Set {@code orderBoardSecret} to save; set {@code clearBoardSecret} to true to remove the key. Set {@code
     * pickupBoardHideGuestNames} to change lobby pickup-board privacy (omit if not updating).
     */
    public record PatchSelfOrderSettingsRequest(
            Boolean clearBoardSecret,
            String orderBoardSecret,
            Boolean pickupBoardHideGuestNames,
            Boolean selfOrderSmsEnabled,
            Boolean selfOrderPushEnabled) {}

    public record ConfirmPaymentRequest(@NotBlank String paymentMethod) {}
}
