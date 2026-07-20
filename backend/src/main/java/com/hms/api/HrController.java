package com.hms.api;

import com.hms.api.dto.HrDtos;
import com.hms.service.HrService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/hr")
public class HrController {

    private static final String HR_READ =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE')";
    private static final String HR_MANAGE =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')";
    private static final String HR_ADMIN =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')";
    private static final String ALL_STAFF =
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_FINANCE','ROLE_RECEPTIONIST','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR','ROLE_MAINTENANCE','ROLE_FNB_STAFF')";

    private final HrService hrService;

    public HrController(HrService hrService) {
        this.hrService = hrService;
    }

    // ── Dashboard ──────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize(HR_READ)
    public HrDtos.HrDashboard dashboard(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return hrService.dashboard(hotelId, hotelHeader);
    }

    // ── Employees ──────────────────────────────────────────────────────────

    @GetMapping("/employees")
    @PreAuthorize(HR_READ)
    public List<HrDtos.EmployeeRow> listEmployees(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return hrService.listEmployees(hotelId, hotelHeader);
    }

    @PutMapping("/employees/{userId}/profile")
    @PreAuthorize(HR_MANAGE)
    public HrDtos.EmployeeRow upsertEmployeeProfile(
            @PathVariable UUID hotelId,
            @PathVariable UUID userId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody HrDtos.UpdateEmployeeProfileRequest body) {
        return hrService.upsertEmployeeProfile(hotelId, hotelHeader, userId, body);
    }

    // ── Payroll ────────────────────────────────────────────────────────────

    @GetMapping("/payroll")
    @PreAuthorize(ALL_STAFF)
    public List<HrDtos.PayrollRecordRow> listPayroll(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        return hrService.listPayroll(hotelId, hotelHeader, year, month);
    }

    @PostMapping("/payroll")
    @PreAuthorize(HR_MANAGE)
    public ResponseEntity<HrDtos.PayrollRecordRow> createPayrollRecord(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody HrDtos.CreatePayrollRecordRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hrService.createPayrollRecord(hotelId, hotelHeader, body));
    }

    @PostMapping("/payroll/{recordId}/review")
    @PreAuthorize(HR_MANAGE)
    public HrDtos.PayrollRecordRow reviewPayroll(
            @PathVariable UUID hotelId,
            @PathVariable UUID recordId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody HrDtos.ReviewPayrollRequest body) {
        return hrService.reviewPayroll(hotelId, hotelHeader, recordId, body);
    }

    @PostMapping("/payroll/{recordId}/paid")
    @PreAuthorize(HR_ADMIN)
    public HrDtos.PayrollRecordRow markPayrollPaid(
            @PathVariable UUID hotelId,
            @PathVariable UUID recordId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return hrService.markPayrollPaid(hotelId, hotelHeader, recordId);
    }

    // ── Leave Types ────────────────────────────────────────────────────────

    @GetMapping("/leave/types")
    @PreAuthorize(ALL_STAFF)
    public List<HrDtos.LeaveTypeRow> listLeaveTypes(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return hrService.listLeaveTypes(hotelId, hotelHeader);
    }

    @PostMapping("/leave/types")
    @PreAuthorize(HR_MANAGE)
    public ResponseEntity<HrDtos.LeaveTypeRow> createLeaveType(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody HrDtos.CreateLeaveTypeRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hrService.createLeaveType(hotelId, hotelHeader, body));
    }

    // ── Leave Balances ─────────────────────────────────────────────────────

    @GetMapping("/leave/balances")
    @PreAuthorize(ALL_STAFF)
    public List<HrDtos.LeaveBalanceRow> listLeaveBalances(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(defaultValue = "0") int year) {
        int effectiveYear = year == 0 ? java.time.LocalDate.now().getYear() : year;
        return hrService.listLeaveBalances(hotelId, hotelHeader, effectiveYear);
    }

    @PostMapping("/leave/balances")
    @PreAuthorize(HR_MANAGE)
    public ResponseEntity<HrDtos.LeaveBalanceRow> setLeaveBalance(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody HrDtos.SetLeaveBalanceRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hrService.setLeaveBalance(hotelId, hotelHeader, body));
    }

    // ── Leave Requests ─────────────────────────────────────────────────────

    @GetMapping("/leave/requests")
    @PreAuthorize(ALL_STAFF)
    public List<HrDtos.LeaveRequestRow> listLeaveRequests(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String status) {
        return hrService.listLeaveRequests(hotelId, hotelHeader, status);
    }

    @PostMapping("/leave/requests")
    @PreAuthorize(ALL_STAFF)
    public ResponseEntity<HrDtos.LeaveRequestRow> submitLeaveRequest(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody HrDtos.CreateLeaveRequestRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hrService.submitLeaveRequest(hotelId, hotelHeader, body));
    }

    @PostMapping("/leave/requests/{requestId}/review")
    @PreAuthorize(HR_MANAGE)
    public HrDtos.LeaveRequestRow reviewLeaveRequest(
            @PathVariable UUID hotelId,
            @PathVariable UUID requestId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody HrDtos.ReviewLeaveRequest body) {
        return hrService.reviewLeaveRequest(hotelId, hotelHeader, requestId, body);
    }

    // ── Recruitment ────────────────────────────────────────────────────────

    @GetMapping("/recruitment/positions")
    @PreAuthorize(HR_READ)
    public List<HrDtos.JobPositionRow> listJobPositions(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) String status) {
        return hrService.listJobPositions(hotelId, hotelHeader, status);
    }

    @PostMapping("/recruitment/positions")
    @PreAuthorize(HR_MANAGE)
    public ResponseEntity<HrDtos.JobPositionRow> createJobPosition(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody HrDtos.CreateJobPositionRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hrService.createJobPosition(hotelId, hotelHeader, body));
    }

    @PutMapping("/recruitment/positions/{positionId}/status")
    @PreAuthorize(HR_MANAGE)
    public HrDtos.JobPositionRow updateJobPositionStatus(
            @PathVariable UUID hotelId,
            @PathVariable UUID positionId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody HrDtos.UpdateJobPositionStatusRequest body) {
        return hrService.updateJobPositionStatus(hotelId, hotelHeader, positionId, body);
    }

    @GetMapping("/recruitment/candidates")
    @PreAuthorize(HR_READ)
    public List<HrDtos.CandidateRow> listCandidates(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestParam(required = false) UUID positionId) {
        return hrService.listCandidates(hotelId, hotelHeader, positionId);
    }

    @PostMapping("/recruitment/candidates")
    @PreAuthorize(HR_MANAGE)
    public ResponseEntity<HrDtos.CandidateRow> createCandidate(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody HrDtos.CreateCandidateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hrService.createCandidate(hotelId, hotelHeader, body));
    }

    @PutMapping("/recruitment/candidates/{candidateId}/stage")
    @PreAuthorize(HR_MANAGE)
    public HrDtos.CandidateRow advanceCandidateStage(
            @PathVariable UUID hotelId,
            @PathVariable UUID candidateId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody HrDtos.AdvanceCandidateStageRequest body) {
        return hrService.advanceCandidateStage(hotelId, hotelHeader, candidateId, body);
    }
}
