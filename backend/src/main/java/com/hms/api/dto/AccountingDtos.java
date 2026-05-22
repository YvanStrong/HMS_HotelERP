package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class AccountingDtos {

    private AccountingDtos() {}

    public record SalesAnalytics(
            LocalDate fromDate,
            LocalDate toDate,
            BigDecimal inventoryInvoiceSales,
            BigDecimal inventoryInvoicePaid,
            BigDecimal posSales,
            BigDecimal totalSales,
            BigDecimal totalExpenses,
            BigDecimal netAfterExpenses,
            long invoiceCount,
            long posSaleCount,
            long pendingPettyCashCount,
            BigDecimal pettyCashDisbursed) {}

    public record ExpenseRow(
            UUID id,
            LocalDate expenseDate,
            String category,
            String vendor,
            String description,
            BigDecimal amount,
            String paymentMethod,
            String referenceNo,
            String recordedBy,
            Instant createdAt) {}

    public record CreateExpenseRequest(
            LocalDate expenseDate,
            @NotBlank String category,
            String vendor,
            @NotBlank String description,
            @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
            String paymentMethod,
            String referenceNo) {}

    public record PettyCashRow(
            UUID id,
            String requestNumber,
            String title,
            String category,
            String reason,
            BigDecimal amountRequested,
            BigDecimal amountApproved,
            String status,
            String requestedBy,
            String approvedBy,
            Instant approvedAt,
            String disbursedBy,
            Instant disbursedAt,
            String rejectionReason,
            String notes,
            Instant createdAt) {}

    public record CreatePettyCashRequest(
            @NotBlank String title,
            @NotBlank String category,
            @NotBlank String reason,
            @NotNull @DecimalMin(value = "0.01") BigDecimal amountRequested,
            String notes) {}

    public record ApprovePettyCashRequest(
            @DecimalMin(value = "0.01") BigDecimal amountApproved,
            String notes) {}

    public record RejectPettyCashRequest(@NotBlank String rejectionReason) {}

    public record DisbursePettyCashRequest(String notes) {}

    public record AccountingDashboard(
            SalesAnalytics analytics,
            List<ExpenseRow> expenses,
            List<PettyCashRow> pettyCashRequests) {}
}
