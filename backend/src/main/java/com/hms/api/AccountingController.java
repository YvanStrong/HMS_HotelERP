package com.hms.api;

import com.hms.api.dto.AccountingDtos;
import com.hms.service.AccountingService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/accounting")
public class AccountingController {

    private static final String ACCOUNTING_READ =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')";
    private static final String STAFF_REQUEST =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_RECEPTIONIST','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR','ROLE_MAINTENANCE','ROLE_FNB_STAFF')";
    private static final String MANAGER_APPROVE =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')";
    private static final String CASH_DISBURSE =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')";

    private final AccountingService accountingService;

    public AccountingController(AccountingService accountingService) {
        this.accountingService = accountingService;
    }

    @GetMapping
    @PreAuthorize(ACCOUNTING_READ)
    public AccountingDtos.AccountingDashboard dashboard(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return accountingService.dashboard(hotelId, hotelHeader, from, to);
    }

    @GetMapping("/sales-analytics")
    @PreAuthorize(ACCOUNTING_READ)
    public AccountingDtos.SalesAnalytics salesAnalytics(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return accountingService.analytics(hotelId, hotelHeader, from, to);
    }

    @PostMapping("/expenses")
    @PreAuthorize(CASH_DISBURSE)
    public ResponseEntity<AccountingDtos.ExpenseRow> createExpense(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody AccountingDtos.CreateExpenseRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(accountingService.createExpense(hotelId, hotelHeader, body));
    }

    @PostMapping("/petty-cash")
    @PreAuthorize(STAFF_REQUEST)
    public ResponseEntity<AccountingDtos.PettyCashRow> createPettyCashRequest(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody AccountingDtos.CreatePettyCashRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(accountingService.createPettyCashRequest(hotelId, hotelHeader, body));
    }

    @PostMapping("/petty-cash/{requestId}/approve")
    @PreAuthorize(MANAGER_APPROVE)
    public AccountingDtos.PettyCashRow approvePettyCash(
            @PathVariable UUID hotelId,
            @PathVariable UUID requestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody AccountingDtos.ApprovePettyCashRequest body) {
        return accountingService.approvePettyCash(hotelId, hotelHeader, requestId, body);
    }

    @PostMapping("/petty-cash/{requestId}/reject")
    @PreAuthorize(MANAGER_APPROVE)
    public AccountingDtos.PettyCashRow rejectPettyCash(
            @PathVariable UUID hotelId,
            @PathVariable UUID requestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody AccountingDtos.RejectPettyCashRequest body) {
        return accountingService.rejectPettyCash(hotelId, hotelHeader, requestId, body);
    }

    @PostMapping("/petty-cash/{requestId}/disburse")
    @PreAuthorize(CASH_DISBURSE)
    public AccountingDtos.PettyCashRow disbursePettyCash(
            @PathVariable UUID hotelId,
            @PathVariable UUID requestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody AccountingDtos.DisbursePettyCashRequest body) {
        return accountingService.disbursePettyCash(hotelId, hotelHeader, requestId, body);
    }
}
