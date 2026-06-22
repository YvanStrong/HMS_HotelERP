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
            BigDecimal payrollExpenses,
            BigDecimal netAfterExpenses,
            long invoiceCount,
            long posSaleCount,
            long pendingPettyCashCount,
            BigDecimal pettyCashDisbursed) {}

    public record PayrollAccountingSyncResponse(int postedCount, String message) {}

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

    public record ReceivableRow(
            UUID id,
            String customerName,
            String invoiceRef,
            LocalDate issueDate,
            LocalDate dueDate,
            BigDecimal amount,
            BigDecimal amountPaid,
            BigDecimal balance,
            String status,
            String notes) {}

    public record CreateReceivableRequest(
            @NotBlank String customerName,
            String invoiceRef,
            LocalDate issueDate,
            LocalDate dueDate,
            @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
            BigDecimal amountPaid,
            String status,
            String notes) {}

    public record PayableRow(
            UUID id,
            String supplierName,
            String billRef,
            LocalDate billDate,
            LocalDate dueDate,
            BigDecimal amount,
            BigDecimal amountPaid,
            BigDecimal balance,
            String status,
            String notes) {}

    public record CreatePayableRequest(
            @NotBlank String supplierName,
            String billRef,
            LocalDate billDate,
            LocalDate dueDate,
            @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
            BigDecimal amountPaid,
            String status,
            String notes) {}

    public record BudgetRow(
            UUID id,
            Integer fiscalYear,
            Integer month,
            String accountCode,
            String accountName,
            BigDecimal budgetAmount,
            BigDecimal actualAmount,
            BigDecimal variance,
            String notes) {}

    public record CreateBudgetRequest(
            @NotNull Integer fiscalYear,
            Integer month,
            @NotBlank String accountCode,
            @NotBlank String accountName,
            @NotNull @DecimalMin(value = "0.00") BigDecimal budgetAmount,
            String notes) {}

    public record TaxFilingRow(
            UUID id,
            String taxType,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal taxableSales,
            BigDecimal taxCollected,
            BigDecimal taxPaid,
            BigDecimal taxDue,
            String status,
            String filingReference,
            Instant filedAt,
            String notes) {}

    public record CreateTaxFilingRequest(
            @NotBlank String taxType,
            @NotNull LocalDate periodStart,
            @NotNull LocalDate periodEnd,
            BigDecimal taxableSales,
            BigDecimal taxCollected,
            BigDecimal taxPaid,
            String status,
            String filingReference,
            String notes) {}

    public record AccountingPeriodRow(
            UUID id,
            String periodName,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            Instant closedAt,
            String closedBy,
            String notes) {}

    public record CreateAccountingPeriodRequest(
            @NotBlank String periodName,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            String notes) {}

    public record ReconciliationRow(
            UUID id,
            String bankName,
            LocalDate statementStart,
            LocalDate statementEnd,
            BigDecimal statementBalance,
            BigDecimal systemBalance,
            BigDecimal difference,
            String status,
            Instant reconciledAt,
            String reconciledBy,
            String notes) {}

    public record CreateReconciliationRequest(
            @NotBlank String bankName,
            @NotNull LocalDate statementStart,
            @NotNull LocalDate statementEnd,
            @NotNull BigDecimal statementBalance,
            BigDecimal systemBalance,
            String status,
            String notes) {}

    public record AdvancedAccountingWorkspace(
            List<ReceivableRow> receivables,
            List<PayableRow> payables,
            List<BudgetRow> budgets,
            List<TaxFilingRow> taxFilings,
            List<AccountingPeriodRow> periods,
            List<ReconciliationRow> reconciliations) {}

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
            AccountingReports reports,
            AdvancedAccountingWorkspace advanced) {}
}
