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

    public record AccountRow(
            UUID id,
            String code,
            String name,
            String accountType,
            String description,
            boolean active) {}

    public record CreateAccountRequest(
            @NotBlank String code,
            @NotBlank String name,
            @NotBlank String accountType,
            String description) {}

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

    public record BankStatementLineRow(
            UUID id,
            LocalDate bookDate,
            LocalDate valueDate,
            String reference,
            String narration,
            BigDecimal debitAmount,
            BigDecimal creditAmount,
            BigDecimal balanceAmount,
            String sourceBank,
            String recordedBy,
            Instant createdAt) {}

    public record BankStatementImportResponse(
            int importedCount,
            int skippedCount,
            String message,
            List<BankStatementLineRow> lines) {}

    public record CreateBankStatementLineRequest(
            @NotNull LocalDate bookDate,
            LocalDate valueDate,
            String reference,
            @NotBlank String narration,
            BigDecimal debitAmount,
            BigDecimal creditAmount,
            BigDecimal balanceAmount,
            String sourceBank) {}

    public record LedgerEntryRow(
            LocalDate date,
            String reference,
            String source,
            String accountCode,
            String accountName,
            String accountType,
            String description,
            BigDecimal debit,
            BigDecimal credit) {}

    public record TrialBalanceRow(
            String accountCode,
            String accountName,
            String accountType,
            BigDecimal debit,
            BigDecimal credit) {}

    public record ProfitLossRow(String accountName, BigDecimal amount) {}

    public record ProfitLossReport(
            LocalDate fromDate,
            LocalDate toDate,
            List<ProfitLossRow> income,
            List<ProfitLossRow> expenses,
            BigDecimal totalIncome,
            BigDecimal totalExpenses,
            BigDecimal netProfit) {}

    public record BalanceSheetRow(String accountName, BigDecimal amount) {}

    public record BalanceSheetReport(
            LocalDate asOfDate,
            List<BalanceSheetRow> assets,
            List<BalanceSheetRow> liabilities,
            List<BalanceSheetRow> equity,
            BigDecimal totalAssets,
            BigDecimal totalLiabilities,
            BigDecimal totalEquity,
            BigDecimal liabilitiesAndEquity) {}

    public record AccountingReports(
            List<LedgerEntryRow> ledger,
            List<TrialBalanceRow> trialBalance,
            ProfitLossReport profitAndLoss,
            BalanceSheetReport balanceSheet,
            List<BankStatementLineRow> bankStatementLines) {}

    public record AccountingDashboard(
            SalesAnalytics analytics,
            List<AccountRow> accounts,
            List<ExpenseRow> expenses,
            List<PettyCashRow> pettyCashRequests,
            AccountingReports reports) {}
}
