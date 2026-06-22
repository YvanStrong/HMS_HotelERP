package com.hms.api.dto;

import com.hms.domain.ShiftStatus;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class PosShiftDtos {

    private PosShiftDtos() {}

    public record OpenShiftRequest(
            @NotNull UUID depotId,
            BigDecimal openingFloat) {}

    public record CloseShiftRequest(
            @NotNull BigDecimal closingCash,
            String closingNotes) {}

    public record ShiftTopItem(String productName, int qtySold, BigDecimal revenue) {}

    public record ShiftDepotRow(
            UUID depotId, String depotName, int orderCount, BigDecimal revenue, BigDecimal cash) {}

    public record ShiftTicketSummary(
            UUID ticketId,
            String depotName,
            String tableLabel,
            Instant closedAt,
            BigDecimal totalAmount,
            String paymentMethod,
            int lineCount) {}

    public record PosShiftDTO(
            UUID id,
            UUID hotelId,
            UUID depotId,
            String depotName,
            UUID waiterUserId,
            String waiterName,
            ShiftStatus status,
            Instant openedAt,
            Instant closedAt,
            BigDecimal openingFloat,
            int totalOrders,
            BigDecimal totalRevenue,
            long durationMinutes,
            BigDecimal cashVariance,
            String cashVarianceStatus) {}

    public record PosShiftSummaryDTO(
            UUID id,
            UUID hotelId,
            UUID depotId,
            String depotName,
            UUID waiterUserId,
            String waiterName,
            ShiftStatus status,
            Instant openedAt,
            Instant closedAt,
            BigDecimal openingFloat,
            int totalOrders,
            BigDecimal totalRevenue,
            long durationMinutes,
            int totalCovers,
            BigDecimal totalCash,
            BigDecimal totalCard,
            BigDecimal totalRoomCharge,
            BigDecimal totalTax,
            int totalCancelled,
            BigDecimal avgTicketValue,
            BigDecimal avgServeTimeMin,
            BigDecimal expectedCash,
            BigDecimal closingCash,
            BigDecimal cashVariance,
            String closingNotes,
            String cashVarianceStatus,
            List<ShiftTopItem> topItems,
            List<ShiftDepotRow> revenueByDepot,
            List<ShiftTicketSummary> tickets) {}
}
