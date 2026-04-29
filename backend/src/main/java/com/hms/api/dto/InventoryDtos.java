package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class InventoryDtos {

    private InventoryDtos() {}

    public record SupplierSummary(UUID id, String name) {}

    public record InventoryItemRow(
            UUID id,
            String name,
            String sku,
            String category,
            BigDecimal currentStock,
            BigDecimal minimumStock,
            BigDecimal reorderPoint,
            String unitOfMeasure,
            BigDecimal unitCost,
            boolean isMinibarItem,
            Integer minibarReorderThreshold,
            String status,
            Instant lastRestocked,
            SupplierSummary supplier) {}

    public record InventoryListSummary(
            long totalItems, long lowStockCount, long outOfStockCount, BigDecimal totalValue) {}

    public record InventoryItemsResponse(List<InventoryItemRow> data, InventoryListSummary summary) {}

    public record ConsumeReference(String type, String id) {}

    public record ConsumeLocation(String from, String to) {}

    public record ConsumeRequest(
            BigDecimal quantity,
            String type,
            ConsumeReference reference,
            ConsumeLocation location,
            String performedBy,
            String notes,
            Boolean autoReorderCheck) {}

    public record ConsumeRoomChargeSummary(UUID chargeId, BigDecimal amount, boolean postedToFolio) {}

    public record ConsumeAlert(String type, String message, BigDecimal suggestedOrderQuantity, String supplier) {}

    public record ConsumeEvent(String type, String itemId, BigDecimal quantity, String chargeId) {}

    public record ConsumeResponse(
            UUID transactionId,
            InventoryItemRow item,
            ConsumeRoomChargeSummary roomCharge,
            List<ConsumeAlert> alerts,
            List<ConsumeEvent> events) {}

    public record PoLineInput(UUID itemId, BigDecimal quantity, BigDecimal unitPrice, String notes) {}

    public record PoApprovalInput(Boolean requiresApproval, List<String> approverRoles, BigDecimal thresholdAmount) {}

    public record CreatePurchaseOrderRequest(
            UUID supplierId,
            LocalDate expectedDelivery,
            String paymentTerms,
            List<PoLineInput> lines,
            PoApprovalInput approvalWorkflow,
            String deliveryInstructions) {}

    public record PoLineResponse(UUID lineId, String itemName, String sku, BigDecimal quantity, BigDecimal unitPrice, BigDecimal lineTotal) {}

    public record CreatePurchaseOrderResponse(
            UUID poId,
            String poNumber,
            String status,
            BigDecimal totalAmount,
            List<PoLineResponse> lines,
            List<String> nextSteps,
            String approvalUrl) {}

    public record ReceiveLineInput(
            UUID poLineId, BigDecimal quantityReceived, String qualityCheck, String notes, String batchNumber, String expiryDate) {}

    public record ReceiveGoodsRequest(
            UUID purchaseOrderId,
            List<ReceiveLineInput> receivedLines,
            String deliveryNote,
            String receivedBy,
            String location) {}

    public record ReceivePoSummary(String poNumber, String status, BigDecimal remainingQuantity) {}

    public record ReceiveStockUpdate(UUID itemId, BigDecimal previousStock, BigDecimal quantityReceived, BigDecimal newStock, String status) {}

    public record ReceiveDiscrepancy(String type, UUID itemId, BigDecimal expected, BigDecimal received, String action) {}

    public record ReceiveAlert(String type, String message) {}

    public record ReceiveGoodsResponse(
            UUID receiptId,
            ReceivePoSummary purchaseOrder,
            List<ReceiveStockUpdate> stockUpdates,
            List<ReceiveDiscrepancy> discrepancies,
            List<ReceiveAlert> alerts) {}

    public record SupplierCreateRequest(
            @NotBlank String name, String contactPerson, String email, String phone) {}

    public record CategoryCreateRequest(@NotBlank String name, @NotBlank String code) {}

    public record InventoryItemCreateRequest(
            @NotBlank String name,
            @NotBlank String sku,
            @NotNull UUID categoryId,
            BigDecimal currentStock,
            BigDecimal reorderPoint,
            BigDecimal unitCost,
            Boolean isMinibarItem,
            Integer minibarReorderThreshold,
            String unitOfMeasure) {}

    public record CreatedIdResponse(UUID id) {}
}
