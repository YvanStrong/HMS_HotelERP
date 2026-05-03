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

    public record DepotRow(UUID id, String name, String code, String depotType, boolean active) {}

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
            boolean active) {}

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

    public record SaleLineInput(@NotNull UUID productId, @NotNull BigDecimal quantity) {}

    public record CreateSaleRequest(String customerName, @NotNull UUID depotId, @NotEmpty List<SaleLineInput> lines) {}

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
            String message) {}

    public record SaleRow(UUID saleId, String saleNumber, String depotName, String customerName, BigDecimal totalAmount, Instant soldAt) {}

    /** Full sale for receipts / reprint (lines included). */
    public record SaleDetailResponse(
            UUID saleId,
            String saleNumber,
            String depotName,
            String customerName,
            BigDecimal totalAmount,
            Instant soldAt,
            List<SaleLineRow> lines) {}
}
