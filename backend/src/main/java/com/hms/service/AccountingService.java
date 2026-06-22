package com.hms.service;

import com.hms.api.dto.AccountingDtos;
import com.hms.entity.AccountingAccount;
import com.hms.entity.AccountingBankStatementLine;
import com.hms.entity.AccountingBudget;
import com.hms.entity.AccountingExpense;
import com.hms.entity.AccountingPayable;
import com.hms.entity.AccountingPeriod;
import com.hms.entity.AccountingReceivable;
import com.hms.entity.AccountingReconciliation;
import com.hms.entity.AccountingTaxFiling;
import com.hms.entity.DepotSale;
import com.hms.entity.FacilityBooking;
import com.hms.entity.Hotel;
import com.hms.entity.InvSalesInvoice;
import com.hms.entity.HrPayrollRecord;
import com.hms.entity.PettyCashRequest;
import com.hms.entity.PurchaseOrder;
import com.hms.repository.AccountingAccountRepository;
import com.hms.repository.AccountingBankStatementLineRepository;
import com.hms.repository.AccountingBudgetRepository;
import com.hms.repository.AccountingExpenseRepository;
import com.hms.repository.AccountingPayableRepository;
import com.hms.repository.AccountingPeriodRepository;
import com.hms.repository.AccountingReceivableRepository;
import com.hms.repository.AccountingReconciliationRepository;
import com.hms.repository.AccountingTaxFilingRepository;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.FacilityBookingRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.HrPayrollRecordRepository;
import com.hms.repository.InvSalesInvoiceRepository;
import com.hms.repository.PettyCashRequestRepository;
import com.hms.repository.PurchaseOrderRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.parsers.DocumentBuilderFactory;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

@Service
public class AccountingService {

    private static final String PENDING = "PENDING";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";
    private static final String DISBURSED = "DISBURSED";
    public static final String SALARY_EXPENSE_CATEGORY = "Salaries & Wages";
    private static final String SALARY_ACCOUNT_CODE = "5100";
    private static final Pattern BANK_TRANSACTION_START =
            Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{4}-\\d{2}-\\d{2})\\s+(\\S+)(?:\\s+(.*))?$");
    private static final Pattern BANK_TRANSACTION_COMPACT = Pattern.compile(
            "(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{4}-\\d{2}-\\d{2})\\s+([A-Z0-9]{8,})\\s+(.*?)(?=\\s+\\d{4}-\\d{2}-\\d{2}\\s+\\d{4}-\\d{2}-\\d{2}\\s+[A-Z0-9]{8,}\\s+|\\s+--\\s+\\d+\\s+of\\s+\\d+\\s+--|$)",
            Pattern.DOTALL);
    private static final Pattern MONEY_TOKEN = Pattern.compile("\\b\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?\\b|\\b\\d+(?:\\.\\d{2})?\\b");
    private static final Pattern EQUITY_TRANSACTION_START =
            Pattern.compile("^(\\d{2}/\\d{2}/\\d{4})\\s+(\\d{2}/\\d{2}/\\d{4})(?:\\s+(.*))?$");
    private static final Pattern ACCESS_TRANSACTION_START =
            Pattern.compile("^(\\d{2}-[A-Za-z]{3}-\\d{4})\\s+(.*)$");
    private static final Pattern ACCESS_DATE_TOKEN = Pattern.compile("\\b\\d{2}-[A-Za-z]{3}-\\d{4}\\b");
    private static final Pattern MONEY_AT_END = Pattern.compile("-?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?|-?\\d+(?:\\.\\d{2})?");
    private static final DateTimeFormatter ACCESS_DATE = DateTimeFormatter.ofPattern("dd-MMM-yyyy", java.util.Locale.ENGLISH);
    private static final List<DefaultAccount> DEFAULT_ACCOUNTS = List.of(
            new DefaultAccount("1000", "Cash / Bank", "ASSET", "Cash, bank, mobile money and card settlements"),
            new DefaultAccount("1100", "Accounts Receivable", "ASSET", "Customer balances owed to the hotel"),
            new DefaultAccount("1200", "Inventory / Purchases", "ASSET", "Inventory items and purchase value"),
            new DefaultAccount("2000", "Accounts Payable", "LIABILITY", "Supplier balances owed by the hotel"),
            new DefaultAccount("2999", "Bank Statement Suspense", "LIABILITY", "Temporary account for imported bank lines until matched"),
            new DefaultAccount("3000", "Owner Equity", "EQUITY", "Owner capital and retained equity"),
            new DefaultAccount("4000", "Sales Revenue", "INCOME", "Room, inventory and POS sales revenue"),
            new DefaultAccount("4010", "Facility Revenue", "INCOME", "Pool, gym, spa and other facility revenue"),
            new DefaultAccount("5000", "General Expenses", "EXPENSE", "Operating expense categories"),
            new DefaultAccount("5100", "Salaries & Wages", "EXPENSE", "Employee payroll and salary payments"));

    private final HotelRepository hotelRepository;
    private final AccountingAccountRepository accountRepository;
    private final InvSalesInvoiceRepository invoiceRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final FacilityBookingRepository facilityBookingRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final AccountingExpenseRepository expenseRepository;
    private final AccountingBankStatementLineRepository bankStatementLineRepository;
    private final PettyCashRequestRepository pettyCashRepository;
    private final AccountingReceivableRepository receivableRepository;
    private final AccountingPayableRepository payableRepository;
    private final AccountingBudgetRepository budgetRepository;
    private final AccountingTaxFilingRepository taxFilingRepository;
    private final AccountingPeriodRepository periodRepository;
    private final AccountingReconciliationRepository reconciliationRepository;
    private final HrPayrollRecordRepository payrollRecordRepository;
    private final TenantAccessService tenantAccessService;

    public AccountingService(
            HotelRepository hotelRepository,
            AccountingAccountRepository accountRepository,
            InvSalesInvoiceRepository invoiceRepository,
            DepotSaleRepository depotSaleRepository,
            FacilityBookingRepository facilityBookingRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            AccountingExpenseRepository expenseRepository,
            AccountingBankStatementLineRepository bankStatementLineRepository,
            PettyCashRequestRepository pettyCashRepository,
            AccountingReceivableRepository receivableRepository,
            AccountingPayableRepository payableRepository,
            AccountingBudgetRepository budgetRepository,
            AccountingTaxFilingRepository taxFilingRepository,
            AccountingPeriodRepository periodRepository,
            AccountingReconciliationRepository reconciliationRepository,
            HrPayrollRecordRepository payrollRecordRepository,
            TenantAccessService tenantAccessService) {
        this.hotelRepository = hotelRepository;
        this.accountRepository = accountRepository;
        this.invoiceRepository = invoiceRepository;
        this.depotSaleRepository = depotSaleRepository;
        this.facilityBookingRepository = facilityBookingRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.expenseRepository = expenseRepository;
        this.bankStatementLineRepository = bankStatementLineRepository;
        this.pettyCashRepository = pettyCashRepository;
        this.receivableRepository = receivableRepository;
        this.payableRepository = payableRepository;
        this.budgetRepository = budgetRepository;
        this.taxFilingRepository = taxFilingRepository;
        this.periodRepository = periodRepository;
        this.reconciliationRepository = reconciliationRepository;
        this.payrollRecordRepository = payrollRecordRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional
    public AccountingDtos.AccountingDashboard dashboard(
            UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate toDate = to != null ? to : LocalDate.now();
        LocalDate fromDate = from != null ? from : toDate.minusDays(29);
        AccountingDtos.AccountingReports reportData = reports(hotelId, fromDate, toDate);

        return new AccountingDtos.AccountingDashboard(
                analytics(hotelId, fromDate, toDate),
                listAccountsInternal(hotelId),
                expenseRepository.findByHotel_IdOrderByExpenseDateDescCreatedAtDesc(hotelId).stream()
                        .map(this::toExpenseRow)
                        .toList(),
                pettyCashRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId).stream()
                        .map(this::toPettyCashRow)
                        .toList(),
                reportData,
                advancedWorkspace(hotelId));
    }

    @Transactional
    public List<AccountingDtos.AccountRow> listAccounts(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return listAccountsInternal(hotelId);
    }

    @Transactional
    public AccountingDtos.AccountRow createAccount(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateAccountRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureDefaultAccounts(hotelId);
        String code = clean(req.code()).toUpperCase();
        if (accountRepository.existsByHotel_IdAndCode(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_EXISTS", "Account code already exists");
        }
        AccountingAccount account = new AccountingAccount();
        account.setHotel(hotel(hotelId));
        account.setCode(code);
        account.setName(clean(req.name()));
        account.setAccountType(parseAccountType(req.accountType()));
        account.setDescription(cleanNullable(req.description()));
        return toAccountRow(accountRepository.save(account));
    }

    @Transactional(readOnly = true)
    public AccountingDtos.AdvancedAccountingWorkspace advanced(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return advancedWorkspace(hotelId);
    }

    @Transactional
    public AccountingDtos.ReceivableRow createReceivable(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateReceivableRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        AccountingReceivable r = new AccountingReceivable();
        r.setHotel(hotel(hotelId));
        r.setCustomerName(clean(req.customerName()));
        r.setInvoiceRef(cleanNullable(req.invoiceRef()));
        r.setIssueDate(req.issueDate() != null ? req.issueDate() : LocalDate.now());
        r.setDueDate(req.dueDate());
        r.setAmount(money(req.amount()));
        r.setAmountPaid(money(req.amountPaid()));
        r.setStatus(normalizeOpenStatus(req.status(), r.getAmount(), r.getAmountPaid()));
        r.setNotes(cleanNullable(req.notes()));
        return toReceivableRow(receivableRepository.save(r));
    }

    @Transactional
    public AccountingDtos.PayableRow createPayable(
            UUID hotelId, String hotelHeader, AccountingDtos.CreatePayableRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        AccountingPayable p = new AccountingPayable();
        p.setHotel(hotel(hotelId));
        p.setSupplierName(clean(req.supplierName()));
        p.setBillRef(cleanNullable(req.billRef()));
        p.setBillDate(req.billDate() != null ? req.billDate() : LocalDate.now());
        p.setDueDate(req.dueDate());
        p.setAmount(money(req.amount()));
        p.setAmountPaid(money(req.amountPaid()));
        p.setStatus(normalizeOpenStatus(req.status(), p.getAmount(), p.getAmountPaid()));
        p.setNotes(cleanNullable(req.notes()));
        return toPayableRow(payableRepository.save(p));
    }

    @Transactional
    public AccountingDtos.BudgetRow createBudget(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateBudgetRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.month() != null && (req.month() < 1 || req.month() > 12)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BUDGET_MONTH", "Budget month must be between 1 and 12");
        }
        AccountingBudget b = new AccountingBudget();
        b.setHotel(hotel(hotelId));
        b.setFiscalYear(req.fiscalYear());
        b.setMonth(req.month());
        b.setAccountCode(clean(req.accountCode()).toUpperCase());
        b.setAccountName(clean(req.accountName()));
        b.setBudgetAmount(money(req.budgetAmount()));
        b.setNotes(cleanNullable(req.notes()));
        return toBudgetRow(budgetRepository.save(b), hotelId);
    }

    @Transactional
    public AccountingDtos.TaxFilingRow createTaxFiling(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateTaxFilingRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.periodEnd().isBefore(req.periodStart())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TAX_PERIOD", "Tax period end must be after start");
        }
        AccountingTaxFiling t = new AccountingTaxFiling();
        t.setHotel(hotel(hotelId));
        t.setTaxType(clean(req.taxType()));
        t.setPeriodStart(req.periodStart());
        t.setPeriodEnd(req.periodEnd());
        t.setTaxableSales(money(req.taxableSales()));
        t.setTaxCollected(money(req.taxCollected()));
        t.setTaxPaid(money(req.taxPaid()));
        t.setTaxDue(t.getTaxCollected().subtract(t.getTaxPaid()));
        t.setStatus(normalizeStatus(req.status(), List.of("DRAFT", "FILED", "PAID"), "DRAFT"));
        t.setFilingReference(cleanNullable(req.filingReference()));
        t.setNotes(cleanNullable(req.notes()));
        if ("FILED".equals(t.getStatus()) || "PAID".equals(t.getStatus())) {
            t.setFiledAt(Instant.now());
        }
        return toTaxFilingRow(taxFilingRepository.save(t));
    }

    @Transactional
    public AccountingDtos.AccountingPeriodRow createPeriod(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateAccountingPeriodRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.endDate().isBefore(req.startDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCOUNTING_PERIOD", "Period end must be after start");
        }
        AccountingPeriod p = new AccountingPeriod();
        p.setHotel(hotel(hotelId));
        p.setPeriodName(clean(req.periodName()));
        p.setStartDate(req.startDate());
        p.setEndDate(req.endDate());
        p.setStatus("OPEN");
        p.setNotes(cleanNullable(req.notes()));
        return toPeriodRow(periodRepository.save(p));
    }

    @Transactional
    public AccountingDtos.AccountingPeriodRow closePeriod(UUID hotelId, String hotelHeader, UUID periodId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        AccountingPeriod p = period(hotelId, periodId);
        p.setStatus("CLOSED");
        p.setClosedAt(Instant.now());
        p.setClosedBy(tenantAccessService.currentUser().getUsername());
        return toPeriodRow(periodRepository.save(p));
    }

    @Transactional
    public AccountingDtos.ReconciliationRow createReconciliation(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateReconciliationRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.statementEnd().isBefore(req.statementStart())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RECONCILIATION_PERIOD", "Statement end must be after start");
        }
        AccountingReconciliation r = new AccountingReconciliation();
        r.setHotel(hotel(hotelId));
        r.setBankName(clean(req.bankName()));
        r.setStatementStart(req.statementStart());
        r.setStatementEnd(req.statementEnd());
        r.setStatementBalance(money(req.statementBalance()));
        BigDecimal systemBalance = req.systemBalance() == null
                ? bankSystemBalance(hotelId, r.getBankName(), r.getStatementStart(), r.getStatementEnd())
                : money(req.systemBalance());
        r.setSystemBalance(systemBalance);
        r.setDifference(r.getStatementBalance().subtract(systemBalance));
        r.setStatus(normalizeStatus(req.status(), List.of("DRAFT", "IN_REVIEW", "RECONCILED"), "DRAFT"));
        r.setNotes(cleanNullable(req.notes()));
        if ("RECONCILED".equals(r.getStatus())) {
            r.setReconciledAt(Instant.now());
            r.setReconciledBy(tenantAccessService.currentUser().getUsername());
        }
        return toReconciliationRow(reconciliationRepository.save(r));
    }

    @Transactional
    public AccountingDtos.ReconciliationRow completeReconciliation(UUID hotelId, String hotelHeader, UUID reconciliationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        AccountingReconciliation r = reconciliation(hotelId, reconciliationId);
        r.setStatus("RECONCILED");
        r.setReconciledAt(Instant.now());
        r.setReconciledBy(tenantAccessService.currentUser().getUsername());
        return toReconciliationRow(reconciliationRepository.save(r));
    }

    @Transactional(readOnly = true)
    public AccountingDtos.SalesAnalytics analytics(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate toDate = to != null ? to : LocalDate.now();
        LocalDate fromDate = from != null ? from : toDate.minusDays(29);
        return analytics(hotelId, fromDate, toDate);
    }

    @Transactional
    public AccountingDtos.ExpenseRow createExpense(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateExpenseRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotel(hotelId);

        AccountingExpense e = new AccountingExpense();
        e.setHotel(hotel);
        e.setExpenseDate(req.expenseDate() != null ? req.expenseDate() : LocalDate.now());
        e.setCategory(clean(req.category()));
        e.setVendor(cleanNullable(req.vendor()));
        e.setDescription(clean(req.description()));
        e.setAmount(req.amount());
        e.setPaymentMethod(cleanNullable(req.paymentMethod()));
        e.setReferenceNo(cleanNullable(req.referenceNo()));
        e.setRecordedBy(tenantAccessService.currentUser().getUsername());
        return toExpenseRow(expenseRepository.save(e));
    }

    @Transactional
    public AccountingDtos.PettyCashRow createPettyCashRequest(
            UUID hotelId, String hotelHeader, AccountingDtos.CreatePettyCashRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotel(hotelId);

        PettyCashRequest p = new PettyCashRequest();
        p.setHotel(hotel);
        p.setRequestNumber(nextRequestNumber(hotelId));
        p.setTitle(clean(req.title()));
        p.setCategory(clean(req.category()));
        p.setReason(clean(req.reason()));
        p.setAmountRequested(req.amountRequested());
        p.setStatus(PENDING);
        p.setRequestedBy(tenantAccessService.currentUser().getUsername());
        p.setNotes(cleanNullable(req.notes()));
        return toPettyCashRow(pettyCashRepository.save(p));
    }

    @Transactional
    public AccountingDtos.PettyCashRow approvePettyCash(
            UUID hotelId, String hotelHeader, UUID requestId, AccountingDtos.ApprovePettyCashRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PettyCashRequest p = pettyCash(hotelId, requestId);
        if (!PENDING.equals(p.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "PETTY_CASH_NOT_PENDING", "Only pending requests can be approved");
        }
        p.setStatus(APPROVED);
        p.setAmountApproved(req.amountApproved() != null ? req.amountApproved() : p.getAmountRequested());
        p.setApprovedBy(tenantAccessService.currentUser().getUsername());
        p.setApprovedAt(Instant.now());
        p.setNotes(cleanNullable(req.notes()));
        return toPettyCashRow(pettyCashRepository.save(p));
    }

    @Transactional
    public AccountingDtos.PettyCashRow rejectPettyCash(
            UUID hotelId, String hotelHeader, UUID requestId, AccountingDtos.RejectPettyCashRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PettyCashRequest p = pettyCash(hotelId, requestId);
        if (!PENDING.equals(p.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "PETTY_CASH_NOT_PENDING", "Only pending requests can be rejected");
        }
        p.setStatus(REJECTED);
        p.setRejectionReason(clean(req.rejectionReason()));
        p.setApprovedBy(tenantAccessService.currentUser().getUsername());
        p.setApprovedAt(Instant.now());
        return toPettyCashRow(pettyCashRepository.save(p));
    }

    @Transactional
    public AccountingDtos.PettyCashRow disbursePettyCash(
            UUID hotelId, String hotelHeader, UUID requestId, AccountingDtos.DisbursePettyCashRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PettyCashRequest p = pettyCash(hotelId, requestId);
        if (!APPROVED.equals(p.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "PETTY_CASH_NOT_APPROVED", "Only approved requests can be disbursed");
        }
        p.setStatus(DISBURSED);
        p.setDisbursedBy(tenantAccessService.currentUser().getUsername());
        p.setDisbursedAt(Instant.now());
        if (req != null && req.notes() != null && !req.notes().isBlank()) {
            p.setNotes(cleanNullable(req.notes()));
        }
        p = pettyCashRepository.save(p);

        AccountingExpense e = new AccountingExpense();
        e.setHotel(p.getHotel());
        e.setExpenseDate(LocalDate.now());
        e.setCategory(p.getCategory());
        e.setVendor(p.getRequestedBy());
        e.setDescription("Petty cash disbursement: " + p.getTitle() + " - " + p.getReason());
        e.setAmount(money(p.getAmountApproved() != null ? p.getAmountApproved() : p.getAmountRequested()));
        e.setPaymentMethod("Petty Cash");
        e.setReferenceNo(p.getRequestNumber());
        e.setRecordedBy(tenantAccessService.currentUser().getUsername());
        expenseRepository.save(e);

        return toPettyCashRow(p);
    }

    @Transactional
    public UUID postPayrollExpense(HrPayrollRecord record, String recordedBy) {
        if (record.getAccountingExpenseId() != null) {
            return record.getAccountingExpenseId();
        }
        UUID hotelId = record.getHotel().getId();
        ensureDefaultAccounts(hotelId);

        LocalDate expenseDate = record.getPaidAt() != null
                ? record.getPaidAt().atZone(ZoneOffset.UTC).toLocalDate()
                : LocalDate.now();
        String employee = record.getUser().getUsername();
        String period = String.format("%04d-%02d", record.getPeriodYear(), record.getPeriodMonth());

        AccountingExpense expense = new AccountingExpense();
        expense.setHotel(record.getHotel());
        expense.setExpenseDate(expenseDate);
        expense.setCategory(SALARY_EXPENSE_CATEGORY);
        expense.setVendor(employee);
        expense.setDescription(String.format(
                "Employee payroll %s — %s (base %s, bonus %s, overtime %s, benefits %s, deductions %s)",
                period,
                employee,
                money(record.getBasePay()),
                money(record.getBonus()),
                money(record.getOvertimePay()),
                money(record.getBenefits()),
                money(record.getDeductions())));
        expense.setAmount(money(record.getNetPay()));
        expense.setPaymentMethod("Bank Transfer");
        expense.setReferenceNo("PAYROLL-" + record.getId());
        expense.setRecordedBy(recordedBy);
        AccountingExpense saved = expenseRepository.save(expense);
        return saved.getId();
    }

    @Transactional
    public AccountingDtos.PayrollAccountingSyncResponse syncUnpostedPayroll(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String actor = tenantAccessService.currentUser().getUsername();
        List<HrPayrollRecord> unposted = payrollRecordRepository.findPaidWithoutAccountingExpense(hotelId);
        int posted = 0;
        for (HrPayrollRecord record : unposted) {
            UUID expenseId = postPayrollExpense(record, actor);
            record.setAccountingExpenseId(expenseId);
            payrollRecordRepository.save(record);
            posted++;
        }
        String message = posted == 0
                ? "All paid payroll records are already posted to accounting."
                : "Posted " + posted + " paid payroll record(s) to accounting.";
        return new AccountingDtos.PayrollAccountingSyncResponse(posted, message);
    }

    @Transactional
    public AccountingDtos.BankStatementLineRow createBankStatementLine(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateBankStatementLineRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        BigDecimal debit = money(req.debitAmount());
        BigDecimal credit = money(req.creditAmount());
        if (debit.signum() <= 0 && credit.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BANK_LINE_AMOUNT_REQUIRED", "Enter debit or credit amount");
        }
        AccountingBankStatementLine line = new AccountingBankStatementLine();
        line.setHotel(hotel(hotelId));
        line.setBookDate(req.bookDate());
        line.setValueDate(req.valueDate());
        line.setReference(cleanNullable(req.reference()));
        line.setNarration(clean(req.narration()));
        line.setDebitAmount(debit);
        line.setCreditAmount(credit);
        line.setBalanceAmount(req.balanceAmount() == null ? null : money(req.balanceAmount()));
        line.setSourceBank(cleanNullable(req.sourceBank()) == null ? "Bank of Kigali" : clean(req.sourceBank()));
        line.setRecordedBy(tenantAccessService.currentUser().getUsername());
        return toBankStatementLineRow(bankStatementLineRepository.save(line));
    }

    @Transactional
    public AccountingDtos.BankStatementImportResponse importBankStatementPdf(
            UUID hotelId, String hotelHeader, MultipartFile file) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "STATEMENT_FILE_REQUIRED", "Upload a bank statement file");
        }
        String originalFilename = file.getOriginalFilename();
        String filename = originalFilename == null ? "" : originalFilename.toLowerCase();
        List<AccountingBankStatementLine> parsed;
        int potentialRows;
        if (filename.endsWith(".pdf")) {
            String text;
            try (PDDocument document = Loader.loadPDF(file.getBytes())) {
                text = new PDFTextStripper().getText(document);
            } catch (Exception e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "PDF_READ_FAILED", "Could not read text from the PDF file");
            }
            parsed = parseBankStatementText(hotel(hotelId), text);
            potentialRows = countPotentialStatementRows(text);
        } else if (filename.endsWith(".xlsx")) {
            parsed = parseMomoWorkbook(hotel(hotelId), file);
            potentialRows = parsed.size();
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "STATEMENT_FILE_UNSUPPORTED", "Only PDF and XLSX statement files are supported");
        }
        List<AccountingDtos.BankStatementLineRow> saved = new ArrayList<>();
        for (AccountingBankStatementLine line : parsed) {
            line.setRecordedBy(tenantAccessService.currentUser().getUsername());
            saved.add(toBankStatementLineRow(bankStatementLineRepository.save(line)));
        }
        int skipped = Math.max(0, potentialRows - saved.size());
        return new AccountingDtos.BankStatementImportResponse(
                saved.size(),
                skipped,
                saved.isEmpty()
                        ? "No bank statement rows were recognized. You can still record lines manually."
                        : "Imported " + saved.size() + " bank statement line(s).",
                saved);
    }

    @Transactional
    public AccountingDtos.AccountingReports reports(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate toDate = to != null ? to : LocalDate.now();
        LocalDate fromDate = from != null ? from : toDate.withDayOfMonth(1);
        return reports(hotelId, fromDate, toDate);
    }

    private AccountingDtos.SalesAnalytics analytics(UUID hotelId, LocalDate fromDate, LocalDate toDate) {
        BigDecimal invoiceSales = invoiceRepository.sumRevenue(hotelId, fromDate, toDate);
        BigDecimal invoicePaid = invoiceRepository.sumPaid(hotelId, fromDate, toDate);
        Instant fromInstant = fromDate.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant toExclusive = toDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        BigDecimal posSales = depotSaleRepository.sumSalesBetween(hotelId, fromInstant, toExclusive);
        BigDecimal expenses = expenseRepository.sumExpenses(hotelId, fromDate, toDate);
        BigDecimal payrollExpenses = expenseRepository.sumExpensesByCategory(
                hotelId, fromDate, toDate, SALARY_EXPENSE_CATEGORY);
        BigDecimal totalSales = safe(invoiceSales).add(safe(posSales));
        return new AccountingDtos.SalesAnalytics(
                fromDate,
                toDate,
                safe(invoiceSales),
                safe(invoicePaid),
                safe(posSales),
                totalSales,
                safe(expenses),
                safe(payrollExpenses),
                totalSales.subtract(safe(expenses)),
                invoiceRepository.countInvoices(hotelId, fromDate, toDate),
                depotSaleRepository.countSalesBetween(hotelId, fromInstant, toExclusive),
                pettyCashRepository.countByHotel_IdAndStatus(hotelId, PENDING),
                safe(pettyCashRepository.sumDisbursed(hotelId)));
    }

    private AccountingDtos.AccountingReports reports(UUID hotelId, LocalDate fromDate, LocalDate toDate) {
        List<AccountingDtos.LedgerEntryRow> ledger = buildLedger(hotelId, fromDate, toDate);
        ensureLedgerAccounts(hotelId, ledger);
        List<AccountingDtos.TrialBalanceRow> trialBalance = trialBalance(ledger);
        AccountingDtos.ProfitLossReport profitAndLoss = profitAndLoss(fromDate, toDate, trialBalance);
        AccountingDtos.BalanceSheetReport balanceSheet = balanceSheet(toDate, trialBalance, profitAndLoss.netProfit());
        List<AccountingDtos.BankStatementLineRow> bankLines = bankStatementLineRepository
                .findByHotel_IdOrderByBookDateDescCreatedAtDesc(hotelId).stream()
                .map(this::toBankStatementLineRow)
                .toList();
        return new AccountingDtos.AccountingReports(ledger, trialBalance, profitAndLoss, balanceSheet, bankLines);
    }

    private List<AccountingDtos.LedgerEntryRow> buildLedger(UUID hotelId, LocalDate fromDate, LocalDate toDate) {
        Instant fromInstant = fromDate.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant toExclusive = toDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        List<AccountingDtos.LedgerEntryRow> rows = new ArrayList<>();

        for (InvSalesInvoice invoice : invoiceRepository.findByHotelAndDateRange(hotelId, fromDate, toDate)) {
            BigDecimal total = money(invoice.getTotalAmount());
            String ref = invoice.getInvoiceNumber();
            String customer = invoice.getCustomerName() == null ? "Customer" : invoice.getCustomerName();
            rows.add(ledger(invoice.getInvoiceDate(), ref, "SALES_INVOICE", "1100", "Accounts Receivable", "ASSET",
                    "Inventory sales invoice - " + customer, total, BigDecimal.ZERO));
            rows.add(ledger(invoice.getInvoiceDate(), ref, "SALES_INVOICE", "4000", "Sales Revenue", "INCOME",
                    "Inventory sales invoice - " + customer, BigDecimal.ZERO, total));
        }

        for (DepotSale sale : depotSaleRepository.findSalesBetween(hotelId, fromInstant, toExclusive)) {
            BigDecimal total = money(sale.getTotalAmount());
            LocalDate date = sale.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            rows.add(ledger(date, sale.getSaleNumber(), "POS_SALE", "1000", "Cash / Bank", "ASSET",
                    "POS sale - " + cleanNullable(sale.getCustomerName()), total, BigDecimal.ZERO));
            rows.add(ledger(date, sale.getSaleNumber(), "POS_SALE", "4000", "Sales Revenue", "INCOME",
                    "POS sale", BigDecimal.ZERO, total));
        }

        for (FacilityBooking booking : facilityBookingRepository.findInvoicedByHotelAndDateRange(hotelId, fromInstant, toExclusive)) {
            BigDecimal total = money(booking.getAmountPaid());
            LocalDate date = booking.getInvoicedAt().atZone(ZoneOffset.UTC).toLocalDate();
            rows.add(ledger(date, booking.getInvoiceNumber(), "FACILITY_INVOICE", "1000", "Cash / Bank", "ASSET",
                    "Facility invoice - " + booking.getFacility().getName(), total, BigDecimal.ZERO));
            rows.add(ledger(date, booking.getInvoiceNumber(), "FACILITY_INVOICE", "4010", "Facility Revenue", "INCOME",
                    "Facility invoice - " + booking.getFacility().getName(), BigDecimal.ZERO, total));
        }

        for (PurchaseOrder po : purchaseOrderRepository.findAccountingPurchasesBetween(hotelId, fromInstant, toExclusive)) {
            BigDecimal total = money(po.getTotalAmount());
            LocalDate date = po.getOrderDate().atZone(ZoneOffset.UTC).toLocalDate();
            rows.add(ledger(date, po.getPoNumber(), "PURCHASE", "1200", "Inventory / Purchases", "ASSET",
                    "Purchase from " + po.getSupplier().getName(), total, BigDecimal.ZERO));
            rows.add(ledger(date, po.getPoNumber(), "PURCHASE", "2000", "Accounts Payable", "LIABILITY",
                    "Purchase from " + po.getSupplier().getName(), BigDecimal.ZERO, total));
        }

        for (AccountingReceivable receivable : receivableRepository.findByHotel_IdOrderByDueDateAscIssueDateDesc(hotelId)) {
            if (receivable.getIssueDate().isBefore(fromDate) || receivable.getIssueDate().isAfter(toDate)) continue;
            BigDecimal total = money(receivable.getAmount());
            String ref = receivable.getInvoiceRef() == null ? receivable.getId().toString() : receivable.getInvoiceRef();
            rows.add(ledger(receivable.getIssueDate(), ref, "AR", "1100", "Accounts Receivable", "ASSET",
                    "Receivable - " + receivable.getCustomerName(), total, BigDecimal.ZERO));
            rows.add(ledger(receivable.getIssueDate(), ref, "AR", "4000", "Sales Revenue", "INCOME",
                    "Receivable - " + receivable.getCustomerName(), BigDecimal.ZERO, total));
            BigDecimal paid = money(receivable.getAmountPaid());
            if (paid.signum() > 0) {
                rows.add(ledger(receivable.getIssueDate(), ref, "AR_PAYMENT", "1000", "Cash / Bank", "ASSET",
                        "Receivable payment - " + receivable.getCustomerName(), paid, BigDecimal.ZERO));
                rows.add(ledger(receivable.getIssueDate(), ref, "AR_PAYMENT", "1100", "Accounts Receivable", "ASSET",
                        "Receivable payment - " + receivable.getCustomerName(), BigDecimal.ZERO, paid));
            }
        }

        for (AccountingPayable payable : payableRepository.findByHotel_IdOrderByDueDateAscBillDateDesc(hotelId)) {
            if (payable.getBillDate().isBefore(fromDate) || payable.getBillDate().isAfter(toDate)) continue;
            BigDecimal total = money(payable.getAmount());
            String ref = payable.getBillRef() == null ? payable.getId().toString() : payable.getBillRef();
            rows.add(ledger(payable.getBillDate(), ref, "AP", "5000", "General Expenses", "EXPENSE",
                    "Payable - " + payable.getSupplierName(), total, BigDecimal.ZERO));
            rows.add(ledger(payable.getBillDate(), ref, "AP", "2000", "Accounts Payable", "LIABILITY",
                    "Payable - " + payable.getSupplierName(), BigDecimal.ZERO, total));
            BigDecimal paid = money(payable.getAmountPaid());
            if (paid.signum() > 0) {
                rows.add(ledger(payable.getBillDate(), ref, "AP_PAYMENT", "2000", "Accounts Payable", "LIABILITY",
                        "Payable payment - " + payable.getSupplierName(), paid, BigDecimal.ZERO));
                rows.add(ledger(payable.getBillDate(), ref, "AP_PAYMENT", "1000", "Cash / Bank", "ASSET",
                        "Payable payment - " + payable.getSupplierName(), BigDecimal.ZERO, paid));
            }
        }

        for (AccountingExpense expense : expenseRepository.findByHotelAndDateRange(hotelId, fromDate, toDate)) {
            BigDecimal total = money(expense.getAmount());
            String expenseCode = expenseAccountCode(expense.getCategory());
            String expenseName = expenseAccountName(expense.getCategory());
            String source = SALARY_EXPENSE_CATEGORY.equalsIgnoreCase(expense.getCategory()) ? "PAYROLL" : "EXPENSE";
            rows.add(ledger(expense.getExpenseDate(), expense.getReferenceNo(), source, expenseCode, expenseName, "EXPENSE",
                    expense.getDescription(), total, BigDecimal.ZERO));
            rows.add(ledger(expense.getExpenseDate(), expense.getReferenceNo(), source, "1000", "Cash / Bank", "ASSET",
                    expense.getDescription(), BigDecimal.ZERO, total));
        }

        for (AccountingBankStatementLine line : bankStatementLineRepository.findByHotelAndDateRange(hotelId, fromDate, toDate)) {
            BigDecimal outgoing = money(line.getDebitAmount());
            BigDecimal incoming = money(line.getCreditAmount());
            if (incoming.signum() > 0) {
                rows.add(ledger(line.getBookDate(), line.getReference(), "BANK_STATEMENT", "1000", "Cash / Bank", "ASSET",
                        line.getNarration(), incoming, BigDecimal.ZERO));
                rows.add(ledger(line.getBookDate(), line.getReference(), "BANK_STATEMENT", "2999", "Bank Statement Suspense", "LIABILITY",
                        line.getNarration(), BigDecimal.ZERO, incoming));
            }
            if (outgoing.signum() > 0) {
                rows.add(ledger(line.getBookDate(), line.getReference(), "BANK_STATEMENT", "2999", "Bank Statement Suspense", "LIABILITY",
                        line.getNarration(), outgoing, BigDecimal.ZERO));
                rows.add(ledger(line.getBookDate(), line.getReference(), "BANK_STATEMENT", "1000", "Cash / Bank", "ASSET",
                        line.getNarration(), BigDecimal.ZERO, outgoing));
            }
        }

        rows.sort(Comparator.comparing(AccountingDtos.LedgerEntryRow::date).reversed()
                .thenComparing(AccountingDtos.LedgerEntryRow::source));
        return rows;
    }

    private List<AccountingDtos.TrialBalanceRow> trialBalance(List<AccountingDtos.LedgerEntryRow> ledger) {
        Map<String, AccountTotal> totals = new LinkedHashMap<>();
        for (AccountingDtos.LedgerEntryRow row : ledger) {
            AccountTotal total = totals.computeIfAbsent(row.accountCode(), code ->
                    new AccountTotal(row.accountCode(), row.accountName(), row.accountType()));
            total.debit = total.debit.add(safe(row.debit()));
            total.credit = total.credit.add(safe(row.credit()));
        }
        return totals.values().stream()
                .map(t -> new AccountingDtos.TrialBalanceRow(t.code, t.name, t.type, money(t.debit), money(t.credit)))
                .sorted(Comparator.comparing(AccountingDtos.TrialBalanceRow::accountCode))
                .toList();
    }

    private AccountingDtos.ProfitLossReport profitAndLoss(
            LocalDate fromDate, LocalDate toDate, List<AccountingDtos.TrialBalanceRow> trialBalance) {
        List<AccountingDtos.ProfitLossRow> income = new ArrayList<>();
        List<AccountingDtos.ProfitLossRow> expenses = new ArrayList<>();
        BigDecimal totalIncome = BigDecimal.ZERO;
        BigDecimal totalExpenses = BigDecimal.ZERO;
        for (AccountingDtos.TrialBalanceRow row : trialBalance) {
            if ("INCOME".equals(row.accountType())) {
                BigDecimal amount = safe(row.credit()).subtract(safe(row.debit()));
                income.add(new AccountingDtos.ProfitLossRow(row.accountName(), money(amount)));
                totalIncome = totalIncome.add(amount);
            } else if ("EXPENSE".equals(row.accountType())) {
                BigDecimal amount = safe(row.debit()).subtract(safe(row.credit()));
                expenses.add(new AccountingDtos.ProfitLossRow(row.accountName(), money(amount)));
                totalExpenses = totalExpenses.add(amount);
            }
        }
        return new AccountingDtos.ProfitLossReport(
                fromDate, toDate, income, expenses, money(totalIncome), money(totalExpenses), money(totalIncome.subtract(totalExpenses)));
    }

    private AccountingDtos.BalanceSheetReport balanceSheet(
            LocalDate toDate, List<AccountingDtos.TrialBalanceRow> trialBalance, BigDecimal netProfit) {
        List<AccountingDtos.BalanceSheetRow> assets = new ArrayList<>();
        List<AccountingDtos.BalanceSheetRow> liabilities = new ArrayList<>();
        List<AccountingDtos.BalanceSheetRow> equity = new ArrayList<>();
        BigDecimal totalAssets = BigDecimal.ZERO;
        BigDecimal totalLiabilities = BigDecimal.ZERO;
        for (AccountingDtos.TrialBalanceRow row : trialBalance) {
            if ("ASSET".equals(row.accountType())) {
                BigDecimal amount = safe(row.debit()).subtract(safe(row.credit()));
                assets.add(new AccountingDtos.BalanceSheetRow(row.accountName(), money(amount)));
                totalAssets = totalAssets.add(amount);
            } else if ("LIABILITY".equals(row.accountType())) {
                BigDecimal amount = safe(row.credit()).subtract(safe(row.debit()));
                liabilities.add(new AccountingDtos.BalanceSheetRow(row.accountName(), money(amount)));
                totalLiabilities = totalLiabilities.add(amount);
            }
        }
        BigDecimal retainedEarnings = safe(netProfit);
        equity.add(new AccountingDtos.BalanceSheetRow("Current Period Earnings", money(retainedEarnings)));
        BigDecimal totalEquity = retainedEarnings;
        return new AccountingDtos.BalanceSheetReport(
                toDate,
                assets,
                liabilities,
                equity,
                money(totalAssets),
                money(totalLiabilities),
                money(totalEquity),
                money(totalLiabilities.add(totalEquity)));
    }

    private AccountingDtos.LedgerEntryRow ledger(
            LocalDate date,
            String reference,
            String source,
            String accountCode,
            String accountName,
            String accountType,
            String description,
            BigDecimal debit,
            BigDecimal credit) {
        return new AccountingDtos.LedgerEntryRow(
                date,
                reference == null || reference.isBlank() ? "-" : reference,
                source,
                accountCode,
                accountName,
                accountType,
                description == null || description.isBlank() ? "-" : description,
                money(debit),
                money(credit));
    }

    private List<AccountingDtos.AccountRow> listAccountsInternal(UUID hotelId) {
        ensureDefaultAccounts(hotelId);
        return accountRepository.findByHotel_IdOrderByCodeAsc(hotelId).stream()
                .map(this::toAccountRow)
                .toList();
    }

    private void ensureDefaultAccounts(UUID hotelId) {
        Hotel h = hotel(hotelId);
        for (DefaultAccount seed : DEFAULT_ACCOUNTS) {
            if (accountRepository.existsByHotel_IdAndCode(hotelId, seed.code())) continue;
            AccountingAccount account = new AccountingAccount();
            account.setHotel(h);
            account.setCode(seed.code());
            account.setName(seed.name());
            account.setAccountType(seed.type());
            account.setDescription(seed.description());
            accountRepository.save(account);
        }
    }

    private void ensureLedgerAccounts(UUID hotelId, List<AccountingDtos.LedgerEntryRow> ledger) {
        Hotel h = hotel(hotelId);
        for (AccountingDtos.LedgerEntryRow row : ledger) {
            if (accountRepository.existsByHotel_IdAndCode(hotelId, row.accountCode())) continue;
            AccountingAccount account = new AccountingAccount();
            account.setHotel(h);
            account.setCode(row.accountCode());
            account.setName(row.accountName());
            account.setAccountType(row.accountType());
            account.setDescription("Auto-created from ledger activity");
            accountRepository.save(account);
        }
    }

    private List<AccountingBankStatementLine> parseBankStatementText(Hotel hotel, String text) {
        text = text == null ? "" : text;
        String upperText = text.toUpperCase();
        if (upperText.contains("EQUITY BANK")) {
            return parseEquityBankStatementText(hotel, text);
        }
        if (upperText.contains("ACCESS BANK") || upperText.contains("ACCOUNT STATEMENT SUMMARY DETAILS")) {
            return parseAccessBankStatementText(hotel, text);
        }

        List<String> records = new ArrayList<>();
        StringBuilder current = null;
        for (String rawLine : text.split("\\R")) {
            String line = rawLine == null ? "" : rawLine.trim().replaceAll("\\s+", " ");
            if (line.isBlank()) continue;
            if (BANK_TRANSACTION_START.matcher(line).matches()) {
                if (current != null) records.add(current.toString());
                current = new StringBuilder(line);
            } else if (current != null && !line.toLowerCase().contains("page ")
                    && !line.toLowerCase().contains("book date")
                    && !line.toLowerCase().contains("bank of kigali")) {
                current.append(' ').append(line);
            }
        }
        if (current != null) records.add(current.toString());

        List<AccountingBankStatementLine> result = new ArrayList<>();
        for (String record : records) {
            AccountingBankStatementLine parsed = parseBankStatementRecord(hotel, record);
            if (parsed != null) result.add(parsed);
        }
        if (result.isEmpty()) {
            result.addAll(parseCompactBankStatementText(hotel, text));
        }
        return result;
    }

    private List<AccountingBankStatementLine> parseEquityBankStatementText(Hotel hotel, String text) {
        List<String> records = collectStatementRecords(text, EQUITY_TRANSACTION_START);
        List<AccountingBankStatementLine> result = new ArrayList<>();
        for (String record : records) {
            Matcher matcher = EQUITY_TRANSACTION_START.matcher(record);
            if (!matcher.matches()) continue;
            String rest = matcher.group(3).trim();
            List<MoneyMatch> amounts = moneyMatches(rest);
            if (amounts.size() < 3) continue;
            MoneyMatch debitToken = amounts.get(amounts.size() - 3);
            MoneyMatch creditToken = amounts.get(amounts.size() - 2);
            MoneyMatch balanceToken = amounts.get(amounts.size() - 1);
            String beforeAmounts = rest.substring(0, debitToken.start()).trim();
            ReferenceAndNarration ref = referenceFromEnd(beforeAmounts);
            AccountingBankStatementLine line = new AccountingBankStatementLine();
            line.setHotel(hotel);
            line.setBookDate(parseFlexibleDate(matcher.group(1)));
            line.setValueDate(parseFlexibleDate(matcher.group(2)));
            line.setReference(ref.reference());
            line.setNarration(ref.narration().isBlank() ? beforeAmounts : ref.narration());
            line.setDebitAmount(money(parseMoney(debitToken.value())));
            line.setCreditAmount(money(parseMoney(creditToken.value())));
            line.setBalanceAmount(money(parseMoney(balanceToken.value())));
            line.setSourceBank("Equity Bank");
            if (!line.getNarration().isBlank()) result.add(line);
        }
        return result;
    }

    private List<AccountingBankStatementLine> parseAccessBankStatementText(Hotel hotel, String text) {
        List<String> records = collectStatementRecords(text, ACCESS_TRANSACTION_START).stream()
                .filter(record -> !record.toLowerCase().startsWith("opening balance")
                        && !record.toLowerCase().startsWith("closing balance"))
                .toList();
        BigDecimal runningBalance = firstMoneyAfter(text, "OPENING BALANCE");
        List<AccountingBankStatementLine> result = new ArrayList<>();
        for (String record : records) {
            Matcher start = ACCESS_TRANSACTION_START.matcher(record);
            if (!start.matches()) continue;
            LocalDate bookDate = parseFlexibleDate(start.group(1));
            String rest = start.group(2).trim();
            Matcher dateMatcher = ACCESS_DATE_TOKEN.matcher(rest);
            int valueDateStart = -1;
            int valueDateEnd = -1;
            String valueDateText = null;
            while (dateMatcher.find()) {
                valueDateStart = dateMatcher.start();
                valueDateEnd = dateMatcher.end();
                valueDateText = dateMatcher.group();
            }
            if (valueDateText == null) continue;
            String details = rest.substring(0, valueDateStart).trim();
            String amountPart = rest.substring(valueDateEnd).trim();
            List<MoneyMatch> amounts = moneyMatches(amountPart);
            if (amounts.isEmpty()) continue;
            BigDecimal balance = money(parseMoney(amounts.get(amounts.size() - 1).value()));
            BigDecimal movement = BigDecimal.ZERO;
            if (runningBalance != null) {
                movement = balance.subtract(runningBalance);
            } else if (amounts.size() >= 2) {
                movement = parseMoney(amounts.get(amounts.size() - 2).value());
            }
            runningBalance = balance;
            if (movement.signum() == 0) continue;
            ReferenceAndNarration ref = referenceFromEnd(details);
            AccountingBankStatementLine line = new AccountingBankStatementLine();
            line.setHotel(hotel);
            line.setBookDate(bookDate);
            line.setValueDate(parseFlexibleDate(valueDateText));
            line.setReference(ref.reference());
            line.setNarration(ref.narration().isBlank() ? details : ref.narration());
            line.setDebitAmount(movement.signum() < 0 ? movement.abs().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            line.setCreditAmount(movement.signum() > 0 ? movement.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            line.setBalanceAmount(balance);
            line.setSourceBank("Access Bank");
            result.add(line);
        }
        return result;
    }

    private List<AccountingBankStatementLine> parseMomoWorkbook(Hotel hotel, MultipartFile file) {
        List<List<String>> rows;
        try {
            rows = readFirstXlsxSheet(file.getBytes());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "XLSX_READ_FAILED", "Could not read the Momo Excel file");
        }
        if (rows.isEmpty()) return List.of();
        Map<String, Integer> headers = new HashMap<>();
        List<String> headerRow = rows.get(0);
        for (int i = 0; i < headerRow.size(); i++) {
            headers.put(headerRow.get(i).trim().toLowerCase(), i);
        }
        List<AccountingBankStatementLine> result = new ArrayList<>();
        for (int i = 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String status = cell(row, headers.get("status"));
            if (!status.isBlank() && !status.equalsIgnoreCase("successful")) continue;
            BigDecimal amount = parseMoney(cell(row, headers.get("amount")));
            if (amount.signum() == 0) continue;
            String type = cell(row, headers.get("type"));
            String fromName = cell(row, headers.get("from name"));
            String toName = cell(row, headers.get("to name"));
            String message = cell(row, headers.get("to message"));
            AccountingBankStatementLine line = new AccountingBankStatementLine();
            line.setHotel(hotel);
            line.setBookDate(parseMomoDate(cell(row, headers.get("date"))));
            line.setValueDate(line.getBookDate());
            line.setReference(cell(row, headers.get("id")));
            line.setNarration(List.of(type, fromName, toName, message).stream()
                    .filter(s -> s != null && !s.isBlank())
                    .reduce((a, b) -> a + " - " + b)
                    .orElse("Momo transaction"));
            line.setDebitAmount(amount.signum() < 0 ? amount.abs().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            line.setCreditAmount(amount.signum() > 0 ? amount.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            line.setBalanceAmount(null);
            line.setSourceBank("Momo");
            result.add(line);
        }
        return result;
    }

    private List<AccountingBankStatementLine> parseCompactBankStatementText(Hotel hotel, String text) {
        String compact = text.replaceAll("\\s+", " ").trim();
        List<AccountingBankStatementLine> result = new ArrayList<>();
        Matcher matcher = BANK_TRANSACTION_COMPACT.matcher(compact);
        while (matcher.find()) {
            AccountingBankStatementLine line = parseBankStatementFields(
                    hotel,
                    matcher.group(1),
                    matcher.group(2),
                    matcher.group(3),
                    matcher.group(4));
            if (line != null) result.add(line);
        }
        return result;
    }

    private AccountingBankStatementLine parseBankStatementRecord(Hotel hotel, String record) {
        Matcher start = BANK_TRANSACTION_START.matcher(record);
        if (!start.matches()) return null;
        return parseBankStatementFields(hotel, start.group(1), start.group(2), start.group(3), start.group(4));
    }

    private AccountingBankStatementLine parseBankStatementFields(
            Hotel hotel, String bookDate, String valueDate, String reference, String rawRest) {
        String rest = rawRest == null ? "" : rawRest.trim();
        List<MoneyMatch> amounts = new ArrayList<>();
        Matcher moneyMatcher = MONEY_TOKEN.matcher(rest);
        while (moneyMatcher.find()) {
            amounts.add(new MoneyMatch(moneyMatcher.group(), moneyMatcher.start(), moneyMatcher.end()));
        }
        List<MoneyMatch> transactionAmounts = amounts.stream()
                .filter(m -> isLikelyStatementAmount(m.value()))
                .toList();
        if (transactionAmounts.size() < 2) return null;
        MoneyMatch balanceToken = transactionAmounts.get(transactionAmounts.size() - 1);
        MoneyMatch amountToken = transactionAmounts.get(transactionAmounts.size() - 2);
        String narration = rest.substring(0, amountToken.start()).trim();
        if (narration.isBlank()) return null;
        BigDecimal amount = parseMoney(amountToken.value());
        BigDecimal balance = parseMoney(balanceToken.value());
        String narrationLower = narration.toLowerCase();
        boolean debit = narrationLower.contains("outward")
                || narrationLower.contains("withdraw")
                || narrationLower.contains("payment")
                || narrationLower.contains("cash/")
                || narrationLower.contains(" cash ");

        AccountingBankStatementLine line = new AccountingBankStatementLine();
        line.setHotel(hotel);
        line.setBookDate(LocalDate.parse(bookDate));
        line.setValueDate(LocalDate.parse(valueDate));
        line.setReference(reference);
        line.setNarration(narration);
        line.setDebitAmount(debit ? amount : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        line.setCreditAmount(debit ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : amount);
        line.setBalanceAmount(balance);
        line.setSourceBank("Bank of Kigali");
        return line;
    }

    private List<String> collectStatementRecords(String text, Pattern startPattern) {
        List<String> records = new ArrayList<>();
        StringBuilder current = null;
        for (String rawLine : text.split("\\R")) {
            String line = rawLine == null ? "" : rawLine.trim().replaceAll("\\s+", " ");
            if (line.isBlank()) continue;
            String lower = line.toLowerCase();
            if (lower.startsWith("opening balance total")
                    || lower.startsWith("closing balance")
                    || lower.startsWith("summary")
                    || lower.contains("page ")
                    || lower.startsWith("-- ")) {
                if (current != null) {
                    records.add(current.toString());
                    current = null;
                }
                continue;
            }
            if (startPattern.matcher(line).matches()) {
                if (current != null) records.add(current.toString());
                current = new StringBuilder(line);
            } else if (current != null) {
                current.append(' ').append(line);
            }
        }
        if (current != null) records.add(current.toString());
        return records;
    }

    private List<MoneyMatch> moneyMatches(String text) {
        List<MoneyMatch> amounts = new ArrayList<>();
        Matcher matcher = MONEY_AT_END.matcher(text == null ? "" : text);
        while (matcher.find()) {
            amounts.add(new MoneyMatch(matcher.group(), matcher.start(), matcher.end()));
        }
        return amounts;
    }

    private ReferenceAndNarration referenceFromEnd(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) return new ReferenceAndNarration(null, "");
        String[] parts = value.split("\\s+");
        String last = parts[parts.length - 1];
        if (last.matches("[A-Za-z0-9][A-Za-z0-9./_-]{4,}")) {
            return new ReferenceAndNarration(last, value.substring(0, Math.max(0, value.length() - last.length())).trim());
        }
        return new ReferenceAndNarration(null, value);
    }

    private BigDecimal firstMoneyAfter(String text, String label) {
        Pattern pattern = Pattern.compile(Pattern.quote(label) + "\\s+(" + MONEY_AT_END.pattern() + ")", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(text == null ? "" : text);
        return matcher.find() ? parseMoney(matcher.group(1)) : null;
    }

    private LocalDate parseFlexibleDate(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) return LocalDate.now();
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ignored) {
            // try statement-specific formats below
        }
        try {
            return LocalDate.parse(value, DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        } catch (DateTimeParseException ignored) {
            // try Access Bank date format below
        }
        return LocalDate.parse(value, ACCESS_DATE);
    }

    private LocalDate parseMomoDate(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.matches("\\d+(?:\\.\\d+)?")) {
            long serialDays = (long) Math.floor(Double.parseDouble(value));
            return LocalDate.of(1899, 12, 30).plusDays(serialDays);
        }
        try {
            return parseFlexibleDate(value);
        } catch (DateTimeParseException ignored) {
            return LocalDateTime.parse(value.replace(' ', 'T')).toLocalDate();
        }
    }

    private String cell(List<String> row, Integer index) {
        if (index == null || index < 0 || index >= row.size()) return "";
        return row.get(index) == null ? "" : row.get(index).trim();
    }

    private List<List<String>> readFirstXlsxSheet(byte[] content) throws Exception {
        Map<String, byte[]> entries = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                entries.put(entry.getName(), zip.readAllBytes());
            }
        }
        List<String> sharedStrings = new ArrayList<>();
        byte[] sharedXml = entries.get("xl/sharedStrings.xml");
        if (sharedXml != null) {
            Element root = parseXml(sharedXml).getDocumentElement();
            NodeList strings = root.getElementsByTagNameNS("*", "si");
            for (int i = 0; i < strings.getLength(); i++) {
                Element si = (Element) strings.item(i);
                NodeList texts = si.getElementsByTagNameNS("*", "t");
                StringBuilder value = new StringBuilder();
                for (int t = 0; t < texts.getLength(); t++) {
                    value.append(texts.item(t).getTextContent());
                }
                sharedStrings.add(value.toString());
            }
        }
        byte[] sheetXml = entries.get("xl/worksheets/sheet1.xml");
        if (sheetXml == null) return List.of();
        Element sheet = parseXml(sheetXml).getDocumentElement();
        NodeList rowNodes = sheet.getElementsByTagNameNS("*", "row");
        List<List<String>> rows = new ArrayList<>();
        for (int i = 0; i < rowNodes.getLength(); i++) {
            Element rowEl = (Element) rowNodes.item(i);
            NodeList cellNodes = rowEl.getElementsByTagNameNS("*", "c");
            List<String> row = new ArrayList<>();
            for (int c = 0; c < cellNodes.getLength(); c++) {
                Element cell = (Element) cellNodes.item(c);
                int index = columnIndex(cell.getAttribute("r"));
                while (row.size() <= index) row.add("");
                row.set(index, xlsxCellValue(cell, sharedStrings));
            }
            rows.add(row);
        }
        return rows;
    }

    private org.w3c.dom.Document parseXml(byte[] xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
    }

    private String xlsxCellValue(Element cell, List<String> sharedStrings) {
        String type = cell.getAttribute("t");
        if ("inlineStr".equals(type)) {
            NodeList texts = cell.getElementsByTagNameNS("*", "t");
            return texts.getLength() == 0 ? "" : texts.item(0).getTextContent();
        }
        NodeList values = cell.getElementsByTagNameNS("*", "v");
        String raw = values.getLength() == 0 ? "" : values.item(0).getTextContent();
        if ("s".equals(type) && !raw.isBlank()) {
            int index = Integer.parseInt(raw);
            return index >= 0 && index < sharedStrings.size() ? sharedStrings.get(index) : "";
        }
        return raw;
    }

    private int columnIndex(String ref) {
        int index = 0;
        for (int i = 0; i < ref.length(); i++) {
            char ch = Character.toUpperCase(ref.charAt(i));
            if (ch < 'A' || ch > 'Z') break;
            index = index * 26 + (ch - 'A' + 1);
        }
        return Math.max(0, index - 1);
    }

    private int countPotentialStatementRows(String text) {
        int count = 0;
        for (String rawLine : text.split("\\R")) {
            String line = rawLine.trim().replaceAll("\\s+", " ");
            if (BANK_TRANSACTION_START.matcher(line).matches()
                    || EQUITY_TRANSACTION_START.matcher(line).matches()
                    || ACCESS_TRANSACTION_START.matcher(line).matches()) count++;
        }
        return count;
    }

    private static boolean isLikelyStatementAmount(String raw) {
        if (raw == null || raw.isBlank()) return false;
        String normalized = raw.replace(",", "");
        if (!normalized.chars().allMatch(ch -> Character.isDigit(ch) || ch == '.')) return false;
        if (normalized.length() >= 8) return false; // phone/reference fragments, not money columns
        try {
            return new BigDecimal(normalized).signum() >= 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private Hotel hotel(UUID hotelId) {
        return hotelRepository.findById(Objects.requireNonNull(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
    }

    private PettyCashRequest pettyCash(UUID hotelId, UUID requestId) {
        return pettyCashRepository.findByIdAndHotel_Id(requestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PETTY_CASH_NOT_FOUND", "Petty cash request not found"));
    }

    private AccountingPeriod period(UUID hotelId, UUID periodId) {
        return periodRepository.findById(Objects.requireNonNull(periodId))
                .filter(p -> p.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ACCOUNTING_PERIOD_NOT_FOUND", "Accounting period not found"));
    }

    private AccountingReconciliation reconciliation(UUID hotelId, UUID reconciliationId) {
        return reconciliationRepository.findById(Objects.requireNonNull(reconciliationId))
                .filter(r -> r.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RECONCILIATION_NOT_FOUND", "Reconciliation not found"));
    }

    private AccountingDtos.AdvancedAccountingWorkspace advancedWorkspace(UUID hotelId) {
        return new AccountingDtos.AdvancedAccountingWorkspace(
                receivableRepository.findByHotel_IdOrderByDueDateAscIssueDateDesc(hotelId).stream()
                        .map(this::toReceivableRow)
                        .toList(),
                payableRepository.findByHotel_IdOrderByDueDateAscBillDateDesc(hotelId).stream()
                        .map(this::toPayableRow)
                        .toList(),
                budgetRepository.findByHotel_IdOrderByFiscalYearDescMonthAscAccountCodeAsc(hotelId).stream()
                        .map(b -> toBudgetRow(b, hotelId))
                        .toList(),
                taxFilingRepository.findByHotel_IdOrderByPeriodEndDescTaxTypeAsc(hotelId).stream()
                        .map(this::toTaxFilingRow)
                        .toList(),
                periodRepository.findByHotel_IdOrderByStartDateDesc(hotelId).stream()
                        .map(this::toPeriodRow)
                        .toList(),
                reconciliationRepository.findByHotel_IdOrderByStatementEndDescCreatedAtDesc(hotelId).stream()
                        .map(this::toReconciliationRow)
                        .toList());
    }

    private String nextRequestNumber(UUID hotelId) {
        long n = pettyCashRepository.countByHotel_Id(hotelId) + 1;
        return "PC-" + LocalDate.now().getYear() + "-" + String.format("%05d", n);
    }

    private AccountingDtos.ReceivableRow toReceivableRow(AccountingReceivable r) {
        BigDecimal balance = money(safe(r.getAmount()).subtract(safe(r.getAmountPaid())));
        return new AccountingDtos.ReceivableRow(
                r.getId(),
                r.getCustomerName(),
                r.getInvoiceRef(),
                r.getIssueDate(),
                r.getDueDate(),
                money(r.getAmount()),
                money(r.getAmountPaid()),
                balance,
                normalizeOpenStatus(r.getStatus(), r.getAmount(), r.getAmountPaid()),
                r.getNotes());
    }

    private AccountingDtos.PayableRow toPayableRow(AccountingPayable p) {
        BigDecimal balance = money(safe(p.getAmount()).subtract(safe(p.getAmountPaid())));
        return new AccountingDtos.PayableRow(
                p.getId(),
                p.getSupplierName(),
                p.getBillRef(),
                p.getBillDate(),
                p.getDueDate(),
                money(p.getAmount()),
                money(p.getAmountPaid()),
                balance,
                normalizeOpenStatus(p.getStatus(), p.getAmount(), p.getAmountPaid()),
                p.getNotes());
    }

    private AccountingDtos.BudgetRow toBudgetRow(AccountingBudget b, UUID hotelId) {
        BigDecimal actual = actualForBudget(hotelId, b);
        return new AccountingDtos.BudgetRow(
                b.getId(),
                b.getFiscalYear(),
                b.getMonth(),
                b.getAccountCode(),
                b.getAccountName(),
                money(b.getBudgetAmount()),
                actual,
                money(safe(b.getBudgetAmount()).subtract(actual)),
                b.getNotes());
    }

    private AccountingDtos.TaxFilingRow toTaxFilingRow(AccountingTaxFiling t) {
        return new AccountingDtos.TaxFilingRow(
                t.getId(),
                t.getTaxType(),
                t.getPeriodStart(),
                t.getPeriodEnd(),
                money(t.getTaxableSales()),
                money(t.getTaxCollected()),
                money(t.getTaxPaid()),
                money(t.getTaxDue()),
                t.getStatus(),
                t.getFilingReference(),
                t.getFiledAt(),
                t.getNotes());
    }

    private AccountingDtos.AccountingPeriodRow toPeriodRow(AccountingPeriod p) {
        return new AccountingDtos.AccountingPeriodRow(
                p.getId(),
                p.getPeriodName(),
                p.getStartDate(),
                p.getEndDate(),
                p.getStatus(),
                p.getClosedAt(),
                p.getClosedBy(),
                p.getNotes());
    }

    private AccountingDtos.ReconciliationRow toReconciliationRow(AccountingReconciliation r) {
        return new AccountingDtos.ReconciliationRow(
                r.getId(),
                r.getBankName(),
                r.getStatementStart(),
                r.getStatementEnd(),
                money(r.getStatementBalance()),
                money(r.getSystemBalance()),
                money(r.getDifference()),
                r.getStatus(),
                r.getReconciledAt(),
                r.getReconciledBy(),
                r.getNotes());
    }

    private AccountingDtos.ExpenseRow toExpenseRow(AccountingExpense e) {
        return new AccountingDtos.ExpenseRow(
                e.getId(),
                e.getExpenseDate(),
                e.getCategory(),
                e.getVendor(),
                e.getDescription(),
                e.getAmount(),
                e.getPaymentMethod(),
                e.getReferenceNo(),
                e.getRecordedBy(),
                e.getCreatedAt());
    }

    private AccountingDtos.PettyCashRow toPettyCashRow(PettyCashRequest p) {
        return new AccountingDtos.PettyCashRow(
                p.getId(),
                p.getRequestNumber(),
                p.getTitle(),
                p.getCategory(),
                p.getReason(),
                p.getAmountRequested(),
                p.getAmountApproved(),
                p.getStatus(),
                p.getRequestedBy(),
                p.getApprovedBy(),
                p.getApprovedAt(),
                p.getDisbursedBy(),
                p.getDisbursedAt(),
                p.getRejectionReason(),
                p.getNotes(),
                p.getCreatedAt());
    }

    private AccountingDtos.AccountRow toAccountRow(AccountingAccount a) {
        return new AccountingDtos.AccountRow(
                a.getId(),
                a.getCode(),
                a.getName(),
                a.getAccountType(),
                a.getDescription(),
                a.isActive());
    }

    private AccountingDtos.BankStatementLineRow toBankStatementLineRow(AccountingBankStatementLine b) {
        return new AccountingDtos.BankStatementLineRow(
                b.getId(),
                b.getBookDate(),
                b.getValueDate(),
                b.getReference(),
                b.getNarration(),
                b.getDebitAmount(),
                b.getCreditAmount(),
                b.getBalanceAmount(),
                b.getSourceBank(),
                b.getRecordedBy(),
                b.getCreatedAt());
    }

    private static String expenseAccountCode(String category) {
        return SALARY_EXPENSE_CATEGORY.equalsIgnoreCase(category) ? SALARY_ACCOUNT_CODE : "5000";
    }

    private static String expenseAccountName(String category) {
        return SALARY_EXPENSE_CATEGORY.equalsIgnoreCase(category) ? SALARY_EXPENSE_CATEGORY : category;
    }

    private static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal money(BigDecimal v) {
        return safe(v).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal actualForBudget(UUID hotelId, AccountingBudget budget) {
        LocalDate start = budget.getMonth() == null
                ? LocalDate.of(budget.getFiscalYear(), 1, 1)
                : LocalDate.of(budget.getFiscalYear(), budget.getMonth(), 1);
        LocalDate end = budget.getMonth() == null
                ? LocalDate.of(budget.getFiscalYear(), 12, 31)
                : start.withDayOfMonth(start.lengthOfMonth());
        BigDecimal total = BigDecimal.ZERO;
        for (AccountingDtos.LedgerEntryRow row : buildLedger(hotelId, start, end)) {
            if (!row.accountCode().equalsIgnoreCase(budget.getAccountCode())) continue;
            if ("INCOME".equals(row.accountType()) || "LIABILITY".equals(row.accountType()) || "EQUITY".equals(row.accountType())) {
                total = total.add(safe(row.credit()).subtract(safe(row.debit())));
            } else {
                total = total.add(safe(row.debit()).subtract(safe(row.credit())));
            }
        }
        return money(total);
    }

    private BigDecimal bankSystemBalance(UUID hotelId, String bankName, LocalDate from, LocalDate to) {
        BigDecimal balance = BigDecimal.ZERO;
        String bank = clean(bankName).toLowerCase();
        for (AccountingBankStatementLine line : bankStatementLineRepository.findByHotelAndDateRange(hotelId, from, to)) {
            if (!clean(line.getSourceBank()).toLowerCase().contains(bank)) continue;
            balance = balance.add(safe(line.getCreditAmount())).subtract(safe(line.getDebitAmount()));
        }
        return money(balance);
    }

    private static String normalizeOpenStatus(String raw, BigDecimal amount, BigDecimal paid) {
        String explicit = clean(raw).toUpperCase().replace(' ', '_');
        if (List.of("OPEN", "PARTIAL", "PAID", "VOID").contains(explicit)) return explicit;
        BigDecimal balance = safe(amount).subtract(safe(paid));
        if (safe(paid).signum() <= 0) return "OPEN";
        return balance.signum() <= 0 ? "PAID" : "PARTIAL";
    }

    private static String normalizeStatus(String raw, List<String> allowed, String fallback) {
        String v = clean(raw).toUpperCase().replace(' ', '_');
        return allowed.contains(v) ? v : fallback;
    }

    private static BigDecimal parseMoney(String raw) {
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        return new BigDecimal(raw.replace(",", "")).setScale(2, RoundingMode.HALF_UP);
    }

    private static String parseAccountType(String raw) {
        String v = clean(raw).toUpperCase().replace(' ', '_');
        if (List.of("ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE").contains(v)) return v;
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ACCOUNT_TYPE", "Account type must be ASSET, LIABILITY, EQUITY, INCOME, or EXPENSE");
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim();
    }

    private static String cleanNullable(String v) {
        if (v == null || v.isBlank()) return null;
        return v.trim();
    }

    private static final class AccountTotal {
        private final String code;
        private final String name;
        private final String type;
        private BigDecimal debit = BigDecimal.ZERO;
        private BigDecimal credit = BigDecimal.ZERO;

        private AccountTotal(String code, String name, String type) {
            this.code = code;
            this.name = name;
            this.type = type;
        }
    }

    private record DefaultAccount(String code, String name, String type, String description) {}

    private record MoneyMatch(String value, int start, int end) {}

    private record ReferenceAndNarration(String reference, String narration) {}
}
