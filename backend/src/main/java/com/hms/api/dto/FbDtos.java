package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class FbDtos {

    private FbDtos() {}

    public record CreateFbOutletRequest(
            @NotBlank String name,
            @NotBlank String code,
            @NotBlank String outletType,
            String description,
            Boolean allowsRoomCharge,
            Boolean acceptsReservations) {}

    public record CreateFbOutletResponse(
            UUID id, String name, String code, String outletType, boolean allowsRoomCharge, String message) {}

    public record FbOutletListItem(UUID id, String name, String code, String outletType, boolean allowsRoomCharge) {}

    public record CreateMenuItemRequest(
            @NotBlank String name,
            @NotBlank String code,
            @NotNull BigDecimal price,
            String itemKind,
            List<String> categories,
            String description) {}

    public record CreateMenuItemResponse(UUID id, UUID outletId, String name, String code, String message) {}

    public record FbPaymentInput(@NotBlank String method, String roomChargeDescription) {}

    public record FbOrderLineInput(
            @NotNull UUID menuItemId,
            @NotNull Integer quantity,
            List<String> modifiers,
            String specialInstructions) {}

    public record CreateFbOrderRequest(
            @NotNull UUID outletId,
            @NotBlank String type,
            UUID reservationId,
            @NotNull @Valid List<FbOrderLineInput> lines,
            FbPaymentInput payment) {}

    public record CreateFbOrderResponse(
            UUID orderId,
            String orderNumber,
            String status,
            Instant estimatedReadyTime,
            Map<String, BigDecimal> totals,
            Map<String, Object> roomCharge,
            List<Map<String, Object>> kitchenRouting,
            Map<String, Object> guestNotification) {}

    public record PatchFbOrderRequest(
            String status, String station, Instant timestamp, String notes, Boolean inventoryDeducted) {}

    public record PatchFbOrderResponse(
            UUID orderId,
            String previousStatus,
            String newStatus,
            Instant updatedAt,
            List<Map<String, Object>> sideEffects,
            List<String> nextActions) {}

    public record ChargeFbOrderToRoomRequest(@NotNull UUID reservationId, String chargeDescription) {}

    public record ChargeFbOrderToRoomResponse(
            UUID orderId, List<Map<String, Object>> roomCharges, Map<String, Object> order) {}

    public record FbMenuItemRow(
            UUID id,
            String name,
            String description,
            BigDecimal price,
            List<String> dietaryTags,
            List<String> allergens,
            boolean available,
            Integer preparationTime,
            String imageUrl) {}

    public record FbMenuCategory(String name, List<FbMenuItemRow> items) {}

    public record FbMenuResponse(
            Map<String, Object> outlet,
            Map<String, Object> menu,
            Map<String, Object> orderingRules) {}
}
