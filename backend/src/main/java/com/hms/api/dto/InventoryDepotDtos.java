package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class InventoryDepotDtos {

    private InventoryDepotDtos() {}

    public record DepotRow(
            UUID id,
            String name,
            String code,
            String depotType,
            boolean active,
            UUID warehouseId,
            String warehouseCode,
            String warehouseName) {}

    public record CreateDepotRequest(@NotBlank String name, String code, String depotType) {}

    public record CreateDepotResponse(UUID id, String name, String code, String depotType, String message) {}

    public record DepotProductRow(
            UUID id,
            UUID depotId,
            String depotName,
            Integer productNumber,
            String productName,
            String productCode,
            String batchNo,
            LocalDate expiryDate,
            BigDecimal costPrice,
            BigDecimal sellingPrice,
            BigDecimal stockQty,
            String stockType,
            String photoUrl,
            String menuName,
            boolean taxable,
            boolean active,
            /** Present when this sellable row is linked to an ERP {@link com.hms.entity.InventoryItem}. */
            UUID inventoryItemId,
            List<String> allergens,
            List<String> dietaryFlags,
            java.util.Map<String, String> nameTranslations) {}

    public record CreateDepotProductRequest(
            @NotNull UUID depotId,
            @NotBlank String productName,
            String batchNo,
            LocalDate expiryDate,
            @NotNull BigDecimal costPrice,
            @NotNull BigDecimal sellingPrice,
            BigDecimal stockQty,
            String stockType,
            String photoUrl,
            String menuName,
            UUID inventoryItemId,
            Boolean taxable) {}

    public record CreateDepotProductResponse(
            UUID id, Integer autoProductNumber, String autoProductCode, String message, DepotProductRow product) {}

    /** At least one field should be non-null; validation is enforced in the service. */
    public record PatchDepotProductRequest(
            String productName,
            String batchNo,
            LocalDate expiryDate,
            BigDecimal costPrice,
            BigDecimal sellingPrice,
            BigDecimal stockQty,
            String stockType,
            String photoUrl,
            String menuName,
            Boolean taxable,
            Boolean active) {}

    /** unitPrice is optional; when set (e.g. from a table ticket snapshot) it overrides catalog price. */
    public record SaleLineInput(
            @NotNull UUID productId, @NotNull BigDecimal quantity, String notes, BigDecimal unitPrice) {}

    public record CreateSaleRequest(
            String customerName,
            @NotNull UUID depotId,
            @NotEmpty List<SaleLineInput> lines,
            Boolean chargeToRoom,
            UUID reservationId,
            /** CASH or CARD (ROOM when chargeToRoom is true). */
            String paymentMethod,
            String tableLabel,
            UUID staffId) {}

    public record CreateDeliveryOrderRequest(
            String customerName,
            String locationLabel,
            @NotNull UUID depotId,
            @NotEmpty List<SaleLineInput> lines,
            UUID staffId) {}

    public record SaleLineRow(
            String productName,
            String productCode,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal,
            boolean taxable) {}

    public record CreateSaleResponse(
            UUID saleId,
            String saleNumber,
            UUID depotId,
            BigDecimal totalAmount,
            Instant soldAt,
            List<SaleLineRow> lines,
            UUID roomChargeId,
            String paymentMethod,
            String message) {}

    public record SaleRow(
            UUID saleId,
            String saleNumber,
            String depotName,
            String customerName,
            BigDecimal totalAmount,
            Instant soldAt,
            String paymentMethod,
            String status) {}

    /** Full sale for receipts / reprint (lines included). */
    public record SaleDetailResponse(
            UUID saleId,
            String saleNumber,
            String depotName,
            String customerName,
            BigDecimal totalAmount,
            Instant soldAt,
            String paymentMethod,
            String status,
            List<SaleLineRow> lines) {}

    public record CreateRefundRequest(String reason) {}

    public record RefundLineRow(
            String productName,
            String productCode,
            BigDecimal quantityRefunded,
            BigDecimal unitPrice,
            BigDecimal lineTotal) {}

    public record RefundResponse(
            UUID refundId,
            String refundNumber,
            UUID saleId,
            String saleNumber,
            String depotName,
            String customerName,
            BigDecimal refundAmount,
            String refundMethod,
            String reason,
            Instant refundedAt,
            List<RefundLineRow> lines,
            String message) {}

    public record RefundRow(
            UUID refundId,
            String refundNumber,
            UUID saleId,
            String saleNumber,
            String depotName,
            String customerName,
            BigDecimal refundAmount,
            String refundMethod,
            String reason,
            Instant refundedAt,
            String createdBy) {}

    public record DeliveryOrderRow(
            UUID deliveryOrderId,
            String deliveryNumber,
            String depotName,
            String customerName,
            String locationLabel,
            BigDecimal totalAmount,
            String status,
            Instant createdAt,
            UUID saleId,
            String saleNumber) {}

    public record DeliveryOrderDetailResponse(
            UUID deliveryOrderId,
            String deliveryNumber,
            String depotName,
            String customerName,
            String locationLabel,
            BigDecimal totalAmount,
            String status,
            Instant createdAt,
            UUID saleId,
            String saleNumber,
            List<SaleLineRow> lines) {}

    public record CreateDeliveryOrderResponse(
            UUID deliveryOrderId,
            String deliveryNumber,
            UUID depotId,
            BigDecimal totalAmount,
            Instant createdAt,
            List<SaleLineRow> lines,
            String message) {}

    public record CreateProformaResponse(
            UUID proformaId,
            String proformaNumber,
            UUID depotId,
            BigDecimal totalAmount,
            Instant createdAt,
            List<SaleLineRow> lines,
            String message) {}

    public record ProformaRow(
            UUID proformaId,
            String proformaNumber,
            String depotName,
            String customerName,
            BigDecimal totalAmount,
            Instant createdAt) {}

    public record ProformaDetailResponse(
            UUID proformaId,
            String proformaNumber,
            String depotName,
            String customerName,
            BigDecimal totalAmount,
            Instant createdAt,
            List<SaleLineRow> lines) {}
}
