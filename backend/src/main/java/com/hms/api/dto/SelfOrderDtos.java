package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
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
            String hotelName) {}

    /** Aggregates for the public self-order “operations” tab (kiosk / QR demo). */
    public record PublicActiveOrderBrief(String displayCode, String status, String lineSummary) {}

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
     */
    public record CreatePublicOrderRequest(
            @NotNull String serviceType,
            @NotNull UUID depotId,
            @NotEmpty List<CreateLineInput> lines,
            String customerNote,
            String paymentMode,
            @JsonProperty("room_charge") RoomChargeVerification roomCharge) {}

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
            String message) {}

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
            List<TrackLineRow> lines) {}

    public record BoardLineBrief(String productName, BigDecimal quantity, String modifiersNote, String photoUrl) {}

    public record BoardOrderCard(
            UUID orderId,
            String displayCode,
            String serviceType,
            String status,
            String depotName,
            Instant createdAt,
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
            List<TrackLineRow> lines) {}

    public record PatchOrderStatusRequest(@NotNull String status) {}

    /**
     * {@code orderBoardSecretEcho} is always null on GET. On PUT it echoes the new secret when one was saved (for QR
     * setup); null when the key was cleared.
     */
    public record StaffSelfOrderSettings(boolean orderBoardKeyConfigured, String orderBoardSecretEcho) {}

    /** Set {@code orderBoardSecret} to save; set {@code clearBoardSecret} to true to remove the key. */
    public record PatchSelfOrderSettingsRequest(Boolean clearBoardSecret, String orderBoardSecret) {}

    public record ConfirmPaymentRequest(@NotBlank String paymentMethod) {}
}
