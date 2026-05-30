package com.hms.service;

import com.hms.api.dto.AccountingDtos;
import com.hms.entity.AccountingAccount;
import com.hms.entity.AccountingBankStatementLine;
import com.hms.entity.AccountingExpense;
import com.hms.entity.DepotSale;
import com.hms.entity.FacilityBooking;
import com.hms.entity.Hotel;
import com.hms.entity.InvSalesInvoice;
import com.hms.entity.PettyCashRequest;
import com.hms.entity.PurchaseOrder;
import com.hms.repository.AccountingAccountRepository;
import com.hms.repository.AccountingBankStatementLineRepository;
import com.hms.repository.AccountingExpenseRepository;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.FacilityBookingRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InvSalesInvoiceRepository;
import com.hms.repository.PettyCashRequestRepository;
import com.hms.repository.PurchaseOrderRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AccountingService {

    private static final String PENDING = "PENDING";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";
    private static final String DISBURSED = "DISBURSED";
    private static final Pattern BANK_TRANSACTION_START =
            Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{4}-\\d{2}-\\d{2})\\s+(\\S+)(?:\\s+(.*))?$");
    private static final Pattern BANK_TRANSACTION_COMPACT = Pattern.compile(
            "(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{4}-\\d{2}-\\d{2})\\s+([A-Z0-9]{8,})\\s+(.*?)(?=\\s+\\d{4}-\\d{2}-\\d{2}\\s+\\d{4}-\\d{2}-\\d{2}\\s+[A-Z0-9]{8,}\\s+|\\s+--\\s+\\d+\\s+of\\s+\\d+\\s+--|$)",
            Pattern.DOTALL);
    private static final Pattern MONEY_TOKEN = Pattern.compile("\\b\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?\\b|\\b\\d+(?:\\.\\d{2})?\\b");
    private static final List<DefaultAccount> DEFAULT_ACCOUNTS = List.of(
            new DefaultAccount("1000", "Cash / Bank", "ASSET", "Cash, bank, mobile money and card settlements"),
            new DefaultAccount("1100", "Accounts Receivable", "ASSET", "Customer balances owed to the hotel"),
            new DefaultAccount("1200", "Inventory / Purchases", "ASSET", "Inventory items and purchase value"),
            new DefaultAccount("2000", "Accounts Payable", "LIABILITY", "Supplier balances owed by the hotel"),
            new DefaultAccount("2999", "Bank Statement Suspense", "LIABILITY", "Temporary account for imported bank lines until matched"),
            new DefaultAccount("3000", "Owner Equity", "EQUITY", "Owner capital and retained equity"),
            new DefaultAccount("4000", "Sales Revenue", "INCOME", "Room, inventory and POS sales revenue"),
            new DefaultAccount("4010", "Facility Revenue", "INCOME", "Pool, gym, spa and other facility revenue"),
            new DefaultAccount("5000", "General Expenses", "EXPENSE", "Operating expense categories"));

    private final HotelRepository hotelRepository;
    private final AccountingAccountRepository accountRepository;
    private final InvSalesInvoiceRepository invoiceRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final FacilityBookingRepository facilityBookingRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final AccountingExpenseRepository expenseRepository;
    private final AccountingBankStatementLineRepository bankStatementLineRepository;
    private final PettyCashRequestRepository pettyCashRepository;
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
                reportData);
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
            throw new ApiException(HttpStatus.BAD_REQUEST, "PDF_REQUIRED", "Upload a bank statement PDF file");
        }
        String originalFilename = file.getOriginalFilename();
        String filename = originalFilename == null ? "" : originalFilename.toLowerCase();
        if (!filename.endsWith(".pdf")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PDF_REQUIRED", "Only PDF files are supported");
        }
        String text;
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            text = new PDFTextStripper().getText(document);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PDF_READ_FAILED", "Could not read text from the PDF file");
        }

        List<AccountingBankStatementLine> parsed = parseBankStatementText(hotel(hotelId), text);
        List<AccountingDtos.BankStatementLineRow> saved = new ArrayList<>();
        for (AccountingBankStatementLine line : parsed) {
            line.setRecordedBy(tenantAccessService.currentUser().getUsername());
            saved.add(toBankStatementLineRow(bankStatementLineRepository.save(line)));
        }
        int skipped = Math.max(0, countPotentialStatementRows(text) - saved.size());
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
        BigDecimal totalSales = safe(invoiceSales).add(safe(posSales));
        return new AccountingDtos.SalesAnalytics(
                fromDate,
                toDate,
                safe(invoiceSales),
                safe(invoicePaid),
                safe(posSales),
                totalSales,
                safe(expenses),
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

        for (AccountingExpense expense : expenseRepository.findByHotelAndDateRange(hotelId, fromDate, toDate)) {
            BigDecimal total = money(expense.getAmount());
            rows.add(ledger(expense.getExpenseDate(), expense.getReferenceNo(), "EXPENSE", "5000", expense.getCategory(), "EXPENSE",
                    expense.getDescription(), total, BigDecimal.ZERO));
            rows.add(ledger(expense.getExpenseDate(), expense.getReferenceNo(), "EXPENSE", "1000", "Cash / Bank", "ASSET",
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

    private int countPotentialStatementRows(String text) {
        int count = 0;
        for (String rawLine : text.split("\\R")) {
            if (BANK_TRANSACTION_START.matcher(rawLine.trim().replaceAll("\\s+", " ")).matches()) count++;
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
        return hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
    }

    private PettyCashRequest pettyCash(UUID hotelId, UUID requestId) {
        return pettyCashRepository.findByIdAndHotel_Id(requestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PETTY_CASH_NOT_FOUND", "Petty cash request not found"));
    }

    private String nextRequestNumber(UUID hotelId) {
        long n = pettyCashRepository.countByHotel_Id(hotelId) + 1;
        return "PC-" + LocalDate.now().getYear() + "-" + String.format("%05d", n);
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

    private static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal money(BigDecimal v) {
        return safe(v).setScale(2, RoundingMode.HALF_UP);
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
}
