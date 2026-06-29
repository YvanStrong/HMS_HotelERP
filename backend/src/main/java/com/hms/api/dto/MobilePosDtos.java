package com.hms.api.dto;

import com.hms.domain.PosTableTicketStatus;
import com.hms.domain.PosTicketLineStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class MobilePosDtos {

    private MobilePosDtos() {}

    public record PosTableRow(
            UUID id,
            UUID depotId,
            String depotName,
            String tableLabel,
            int sortOrder,
            int capacity,
            boolean active,
            boolean occupied,
            UUID activeTicketId,
            String waiterName) {}

    public record CreatePosTableRequest(
            @NotNull UUID depotId,
            @NotBlank String label,
            @NotNull @Min(1) @Max(20) Integer capacity,
            Integer sortOrder) {}

    public record UpdatePosTableRequest(String label, Integer capacity, Boolean isActive, Integer sortOrder) {}

    public record TicketLineInput(
            @NotNull UUID productId,
            @NotNull BigDecimal quantity,
            String notes,
            Boolean isHeld,
            String holdCourse) {}

    public record FireHeldRequest(String course) {}

    public record SendToKitchenRequest(Boolean fireHeld) {}

    public record CreateTicketRequest(
            @NotNull UUID depotId,
            @NotBlank String tableLabel,
            UUID tableId,
            String customerName,
            Integer guestCount,
            UUID reservationId,
            String notes,
            List<TicketLineInput> lines) {}

    public record AddTicketLinesRequest(@NotNull List<TicketLineInput> lines) {}

    public record UpdateTicketStatusRequest(@NotNull PosTableTicketStatus status) {}

    public record CloseTicketRequest(
            @NotBlank String mode,
            String paymentMethod,
            Boolean chargeToRoom,
            UUID reservationId,
            String customerName,
            BigDecimal tipAmount) {}

    public record TransferTicketRequest(@NotNull UUID newTableId) {}

    public record MergeTicketsRequest(@NotNull UUID sourceTicketId) {}

    public record ReassignTicketRequest(@NotNull UUID newWaiterUserId) {}

    public record ReservationHintResponse(
            UUID reservationId,
            String guestName,
            int guestCount,
            String dietaryNotes,
            String roomNumber,
            String checkInTime,
            String specialRequests) {}

    public record VoidLineRequest(@NotBlank String reason, @NotBlank String managerPin) {}

    public record LineDiscountRequest(
            @NotBlank String discountType,
            @NotNull BigDecimal discountValue,
            @NotBlank String reason,
            @NotBlank String managerPin) {}

    public record TicketLineRow(
            UUID id,
            UUID productId,
            String productName,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal,
            String notes,
            PosTicketLineStatus lineStatus,
            boolean taxable,
            int round,
            Instant sentAt,
            Instant servedAt,
            boolean voided,
            String voidReason,
            BigDecimal discountPct,
            BigDecimal discountAmount,
            BigDecimal effectivePrice,
            String menuCategory,
            boolean held,
            String holdCourse,
            List<String> allergens,
            List<String> dietaryFlags) {}

    public record TicketRow(
            UUID id,
            UUID depotId,
            String depotName,
            UUID tableId,
            String tableLabel,
            PosTableTicketStatus status,
            String customerName,
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal totalAmount,
            int lineCount,
            int currentRound,
            Instant openedAt,
            Instant kitchenSentAt,
            Instant createdAt,
            Instant updatedAt,
            UUID saleId,
            String saleNumber,
            UUID deliveryOrderId,
            String deliveryNumber,
            String waiterName) {}

    public record TicketDetailResponse(
            UUID id,
            UUID depotId,
            String depotName,
            UUID tableId,
            String tableLabel,
            PosTableTicketStatus status,
            String customerName,
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal totalAmount,
            int currentRound,
            Instant openedAt,
            Instant kitchenSentAt,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            UUID saleId,
            String saleNumber,
            UUID deliveryOrderId,
            String deliveryNumber,
            String waiterName,
            BigDecimal discountTotal,
            Integer guestCount,
            UUID reservationId,
            String roomNumber,
            String dietaryNotes,
            String reservationSpecialRequests,
            String reservationCheckInTime,
            BigDecimal tipAmount,
            List<TicketLineRow> lines) {}

    public record CreateAnnouncementRequest(
            @NotBlank String message,
            String type,
            UUID depotId,
            Instant expiresAt) {}

    public record AnnouncementRow(
            UUID id,
            String message,
            String type,
            UUID depotId,
            String depotName,
            Instant createdAt,
            Instant expiresAt) {}

    public record KitchenTicketRow(
            UUID ticketId,
            String tableLabel,
            String depotName,
            PosTableTicketStatus status,
            Instant updatedAt,
            List<TicketLineRow> lines) {}

    public record LineReadyEvent(
            UUID ticketId,
            UUID lineId,
            String tableLabel,
            String productName,
            PosTicketLineStatus lineStatus,
            Instant at) {}

    public record TableStatusEvent(UUID depotId, UUID tableId, String tableLabel, boolean occupied, UUID ticketId) {}

    public record DepotRevenueRow(UUID depotId, String depotName, BigDecimal revenue, int orderCount) {}

    public record TopItemRow(String productName, int quantity, BigDecimal revenue) {}

    public record WaiterStatRow(
            UUID waiterId, String waiterName, int orderCount, BigDecimal revenue, Long avgServeMinutes) {}

    public record PosDailySummary(
            BigDecimal totalRevenue,
            int orderCount,
            BigDecimal avgTicketValue,
            List<DepotRevenueRow> revenueByDepot,
            List<TopItemRow> topItems,
            List<WaiterStatRow> waiterStats,
            long activeShifts,
            long shiftCount) {}

    /** Real-time + inbox notification when mobile POS creates or updates an order. */
    public record PosOrderNotificationRow(
            UUID eventId,
            String eventType,
            String title,
            String body,
            String staffUsername,
            String staffDisplayName,
            String tableLabel,
            String depotName,
            int itemCount,
            String itemSummary,
            Instant at,
            UUID ticketId,
            UUID saleId,
            UUID deliveryOrderId) {}

    public record PosLineAuditRow(
            UUID id,
            UUID ticketId,
            UUID lineId,
            String action,
            String productName,
            String tableLabel,
            String waiterName,
            BigDecimal originalPrice,
            int originalQty,
            BigDecimal discountPct,
            BigDecimal discountAmount,
            String reason,
            UUID authorizedBy,
            String authorizedByName,
            UUID createdBy,
            String createdByName,
            Instant createdAt) {}
}
