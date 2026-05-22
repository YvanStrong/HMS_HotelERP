package com.hms.service;

import com.hms.api.dto.AccountingDtos;
import com.hms.entity.AccountingExpense;
import com.hms.entity.Hotel;
import com.hms.entity.PettyCashRequest;
import com.hms.repository.AccountingExpenseRepository;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InvSalesInvoiceRepository;
import com.hms.repository.PettyCashRequestRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountingService {

    private static final String PENDING = "PENDING";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";
    private static final String DISBURSED = "DISBURSED";

    private final HotelRepository hotelRepository;
    private final InvSalesInvoiceRepository invoiceRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final AccountingExpenseRepository expenseRepository;
    private final PettyCashRequestRepository pettyCashRepository;
    private final TenantAccessService tenantAccessService;

    public AccountingService(
            HotelRepository hotelRepository,
            InvSalesInvoiceRepository invoiceRepository,
            DepotSaleRepository depotSaleRepository,
            AccountingExpenseRepository expenseRepository,
            PettyCashRequestRepository pettyCashRepository,
            TenantAccessService tenantAccessService) {
        this.hotelRepository = hotelRepository;
        this.invoiceRepository = invoiceRepository;
        this.depotSaleRepository = depotSaleRepository;
        this.expenseRepository = expenseRepository;
        this.pettyCashRepository = pettyCashRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional(readOnly = true)
    public AccountingDtos.AccountingDashboard dashboard(
            UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate toDate = to != null ? to : LocalDate.now();
        LocalDate fromDate = from != null ? from : toDate.minusDays(29);

        return new AccountingDtos.AccountingDashboard(
                analytics(hotelId, fromDate, toDate),
                expenseRepository.findByHotel_IdOrderByExpenseDateDescCreatedAtDesc(hotelId).stream()
                        .map(this::toExpenseRow)
                        .toList(),
                pettyCashRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId).stream()
                        .map(this::toPettyCashRow)
                        .toList());
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
        return toPettyCashRow(pettyCashRepository.save(p));
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

    private static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim();
    }

    private static String cleanNullable(String v) {
        if (v == null || v.isBlank()) return null;
        return v.trim();
    }
}
