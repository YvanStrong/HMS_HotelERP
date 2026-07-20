package com.hms.service;

import com.hms.api.dto.HrDtos;
import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.security.UserPrincipal;
import com.hms.entity.Hotel;
import com.hms.entity.HrCandidate;
import com.hms.entity.HrEmployeeProfile;
import com.hms.entity.HrJobPosition;
import com.hms.entity.HrLeaveBalance;
import com.hms.entity.HrLeaveRequest;
import com.hms.entity.HrLeaveType;
import com.hms.entity.HrPayrollRecord;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HrCandidateRepository;
import com.hms.repository.HrEmployeeProfileRepository;
import com.hms.repository.HrJobPositionRepository;
import com.hms.repository.HrLeaveBalanceRepository;
import com.hms.repository.HrLeaveRequestRepository;
import com.hms.repository.HrLeaveTypeRepository;
import com.hms.repository.HrPayrollRecordRepository;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HrService {

    private static final String PENDING = "PENDING";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";
    private static final String DRAFT = "DRAFT";
    private static final String PAID = "PAID";

    private final TenantAccessService tenantAccessService;
    private final HotelRepository hotelRepository;
    private final AppUserRepository appUserRepository;
    private final HrEmployeeProfileRepository employeeProfileRepository;
    private final HrPayrollRecordRepository payrollRecordRepository;
    private final HrLeaveTypeRepository leaveTypeRepository;
    private final HrLeaveBalanceRepository leaveBalanceRepository;
    private final HrLeaveRequestRepository leaveRequestRepository;
    private final HrJobPositionRepository jobPositionRepository;
    private final HrCandidateRepository candidateRepository;
    private final AccountingService accountingService;

    public HrService(
            TenantAccessService tenantAccessService,
            HotelRepository hotelRepository,
            AppUserRepository appUserRepository,
            HrEmployeeProfileRepository employeeProfileRepository,
            HrPayrollRecordRepository payrollRecordRepository,
            HrLeaveTypeRepository leaveTypeRepository,
            HrLeaveBalanceRepository leaveBalanceRepository,
            HrLeaveRequestRepository leaveRequestRepository,
            HrJobPositionRepository jobPositionRepository,
            HrCandidateRepository candidateRepository,
            AccountingService accountingService) {
        this.tenantAccessService = tenantAccessService;
        this.hotelRepository = hotelRepository;
        this.appUserRepository = appUserRepository;
        this.employeeProfileRepository = employeeProfileRepository;
        this.payrollRecordRepository = payrollRecordRepository;
        this.leaveTypeRepository = leaveTypeRepository;
        this.leaveBalanceRepository = leaveBalanceRepository;
        this.leaveRequestRepository = leaveRequestRepository;
        this.jobPositionRepository = jobPositionRepository;
        this.candidateRepository = candidateRepository;
        this.accountingService = accountingService;
    }

    // ── Dashboard ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public HrDtos.HrDashboard dashboard(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        long totalStaff = appUserRepository.countByHotel_Id(hotelId);
        List<HrEmployeeProfile> profiles = employeeProfileRepository.findByHotelIdWithUser(hotelId);
        long active = profiles.stream().filter(p -> "ACTIVE".equals(p.getEmploymentStatus())).count();
        long onLeave = profiles.stream().filter(p -> "ON_LEAVE".equals(p.getEmploymentStatus())).count();
        long remote = profiles.stream().filter(p -> "REMOTE".equals(p.getEmploymentStatus())).count();
        long pendingLeave = leaveRequestRepository.findByHotelIdAndStatus(hotelId, PENDING).size();
        long openPositions = jobPositionRepository.findByHotel_IdAndStatusOrderByCreatedAtDesc(hotelId, "OPEN").size();
        long totalCandidates = candidateRepository.findByHotelId(hotelId).size();
        return new HrDtos.HrDashboard(totalStaff, active, onLeave, remote, pendingLeave, openPositions, totalCandidates);
    }

    // ── Employees ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HrDtos.EmployeeRow> listEmployees(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<AppUser> staffUsers = appUserRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId);
        List<HrEmployeeProfile> profiles = employeeProfileRepository.findByHotelIdWithUser(hotelId);
        java.util.Map<UUID, HrEmployeeProfile> profileByUserId = new java.util.HashMap<>();
        for (HrEmployeeProfile p : profiles) {
            profileByUserId.put(p.getUser().getId(), p);
        }
        return staffUsers.stream()
                .filter(u -> u.getRole() != Role.GUEST)
                .map(u -> toEmployeeRowFromUser(u, profileByUserId.get(u.getId())))
                .toList();
    }

    @Transactional
    public HrDtos.EmployeeRow upsertEmployeeProfile(UUID hotelId, String hotelHeader, UUID userId, HrDtos.UpdateEmployeeProfileRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
        AppUser user = appUserRepository.findById(userId)
                .filter(u -> u.getHotel() != null && u.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found in this hotel"));

        HrEmployeeProfile profile = employeeProfileRepository
                .findByHotelIdAndUserId(hotelId, userId)
                .orElseGet(() -> {
                    HrEmployeeProfile p = new HrEmployeeProfile();
                    p.setHotel(hotel);
                    p.setUser(user);
                    return p;
                });

        if (req.department() != null) profile.setDepartment(req.department().isBlank() ? null : req.department().trim());
        if (req.jobTitle() != null) profile.setJobTitle(req.jobTitle().isBlank() ? null : req.jobTitle().trim());
        if (req.employmentType() != null) profile.setEmploymentType(req.employmentType());
        if (req.employmentStatus() != null) profile.setEmploymentStatus(req.employmentStatus());
        if (req.hireDate() != null) profile.setHireDate(req.hireDate());
        if (req.baseSalary() != null) profile.setBaseSalary(req.baseSalary());
        if (req.salaryCurrency() != null) profile.setSalaryCurrency(req.salaryCurrency());
        if (req.phone() != null) profile.setPhone(req.phone().isBlank() ? null : req.phone().trim());
        if (req.address() != null) profile.setAddress(req.address().isBlank() ? null : req.address().trim());
        if (req.nationalId() != null) profile.setNationalId(req.nationalId().isBlank() ? null : req.nationalId().trim());
        if (req.emergencyContactName() != null) profile.setEmergencyContactName(req.emergencyContactName().isBlank() ? null : req.emergencyContactName().trim());
        if (req.emergencyContactPhone() != null) profile.setEmergencyContactPhone(req.emergencyContactPhone().isBlank() ? null : req.emergencyContactPhone().trim());
        if (req.notes() != null) profile.setNotes(req.notes().isBlank() ? null : req.notes().trim());

        HrEmployeeProfile saved = employeeProfileRepository.save(profile);
        return toEmployeeRowFromUser(saved.getUser(), saved);
    }

    private HrDtos.EmployeeRow toEmployeeRowFromUser(AppUser u, HrEmployeeProfile p) {
        if (p == null) {
            return new HrDtos.EmployeeRow(
                    null, u.getId(), u.getUsername(), u.getEmail(),
                    u.getRole().name(), u.isActive(),
                    null, null, null, null, null, null, null, null, null, null, null, null, null, false);
        }
        return new HrDtos.EmployeeRow(
                p.getId(), u.getId(), u.getUsername(), u.getEmail(),
                u.getRole().name(), u.isActive(),
                p.getDepartment(), p.getJobTitle(), p.getEmploymentType(), p.getEmploymentStatus(),
                p.getHireDate(), p.getBaseSalary(), p.getSalaryCurrency(), p.getPhone(),
                p.getAddress(), p.getNationalId(), p.getEmergencyContactName(), p.getEmergencyContactPhone(),
                p.getNotes(), true);
    }

    // ── Payroll ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HrDtos.PayrollRecordRow> listPayroll(UUID hotelId, String hotelHeader, Integer year, Integer month) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal current = tenantAccessService.currentUser();
        List<HrPayrollRecord> records;
        if (isHrManager(current)) {
            records = (year != null && month != null)
                    ? payrollRecordRepository.findByHotelAndPeriod(hotelId, year, month)
                    : payrollRecordRepository.findByHotelId(hotelId);
        } else {
            UUID userId = current.getId();
            records = (year != null && month != null)
                    ? payrollRecordRepository.findAllByHotelUserAndPeriod(hotelId, userId, year, month)
                    : payrollRecordRepository.findByHotelAndUser(hotelId, userId);
        }
        return records.stream().map(this::toPayrollRow).toList();
    }

    @Transactional
    public HrDtos.PayrollRecordRow createPayrollRecord(UUID hotelId, String hotelHeader, HrDtos.CreatePayrollRecordRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
        AppUser user = appUserRepository.findById(req.userId())
                .filter(u -> u.getHotel() != null && u.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found"));

        if (payrollRecordRepository.findByHotelUserAndPeriod(hotelId, req.userId(), req.periodYear(), req.periodMonth()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "PAYROLL_EXISTS", "Payroll record already exists for this period");
        }

        BigDecimal bonus = coalesce(req.bonus());
        BigDecimal overtime = coalesce(req.overtimePay());
        BigDecimal benefits = coalesce(req.benefits());
        BigDecimal deductions = coalesce(req.deductions());
        BigDecimal netPay = req.basePay().add(bonus).add(overtime).add(benefits).subtract(deductions);

        HrPayrollRecord record = new HrPayrollRecord();
        record.setHotel(hotel);
        record.setUser(user);
        record.setPeriodYear(req.periodYear());
        record.setPeriodMonth(req.periodMonth());
        record.setBasePay(req.basePay());
        record.setBonus(bonus);
        record.setOvertimePay(overtime);
        record.setBenefits(benefits);
        record.setDeductions(deductions);
        record.setNetPay(netPay);
        record.setCurrency(req.currency() != null ? req.currency() : "USD");
        record.setNotes(req.notes());
        record.setStatus(DRAFT);

        return toPayrollRow(payrollRecordRepository.save(record));
    }

    @Transactional
    public HrDtos.PayrollRecordRow reviewPayroll(UUID hotelId, String hotelHeader, UUID recordId, HrDtos.ReviewPayrollRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        HrPayrollRecord record = payrollRecordRepository.findById(recordId)
                .filter(r -> r.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RECORD_NOT_FOUND", "Payroll record not found"));
        if (!DRAFT.equals(record.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_REVIEWED", "Payroll record has already been reviewed");
        }
        String reviewer = tenantAccessService.currentUser().getUsername();
        record.setStatus(req.approve() ? APPROVED : REJECTED);
        record.setApprovedBy(reviewer);
        record.setApprovedAt(Instant.now());
        if (req.notes() != null) record.setNotes(req.notes());
        return toPayrollRow(payrollRecordRepository.save(record));
    }

    @Transactional
    public HrDtos.PayrollRecordRow markPayrollPaid(UUID hotelId, String hotelHeader, UUID recordId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        HrPayrollRecord record = payrollRecordRepository.findById(recordId)
                .filter(r -> r.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RECORD_NOT_FOUND", "Payroll record not found"));
        if (!APPROVED.equals(record.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_APPROVED", "Only approved payroll records can be marked as paid");
        }
        record.setStatus(PAID);
        record.setPaidAt(Instant.now());
        String actor = tenantAccessService.currentUser().getUsername();
        UUID expenseId = accountingService.postPayrollExpense(record, actor);
        record.setAccountingExpenseId(expenseId);
        return toPayrollRow(payrollRecordRepository.save(record));
    }

    private HrDtos.PayrollRecordRow toPayrollRow(HrPayrollRecord r) {
        AppUser u = r.getUser();
        String dept = employeeProfileRepository.findByHotelIdAndUserId(r.getHotel().getId(), u.getId())
                .map(HrEmployeeProfile::getDepartment).orElse(null);
        return new HrDtos.PayrollRecordRow(
                r.getId(), u.getId(), u.getUsername(), dept,
                r.getPeriodYear(), r.getPeriodMonth(),
                r.getBasePay(), r.getBonus(), r.getOvertimePay(), r.getBenefits(),
                r.getDeductions(), r.getNetPay(), r.getCurrency(),
                r.getStatus(), r.getApprovedBy(), r.getApprovedAt(), r.getPaidAt(),
                r.getNotes(), r.getCreatedAt());
    }

    // ── Leave Types ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HrDtos.LeaveTypeRow> listLeaveTypes(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return leaveTypeRepository.findByHotel_IdOrderByName(hotelId).stream()
                .map(this::toLeaveTypeRow).toList();
    }

    @Transactional
    public HrDtos.LeaveTypeRow createLeaveType(UUID hotelId, String hotelHeader, HrDtos.CreateLeaveTypeRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (leaveTypeRepository.existsByHotel_IdAndNameIgnoreCase(hotelId, req.name())) {
            throw new ApiException(HttpStatus.CONFLICT, "LEAVE_TYPE_EXISTS", "A leave type with this name already exists");
        }
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
        HrLeaveType lt = new HrLeaveType();
        lt.setHotel(hotel);
        lt.setName(req.name().trim());
        lt.setAnnualDaysAllowed(req.annualDaysAllowed());
        lt.setPaid(req.isPaid());
        lt.setDescription(req.description());
        return toLeaveTypeRow(leaveTypeRepository.save(lt));
    }

    private HrDtos.LeaveTypeRow toLeaveTypeRow(HrLeaveType lt) {
        return new HrDtos.LeaveTypeRow(lt.getId(), lt.getName(), lt.getAnnualDaysAllowed(), lt.isPaid(), lt.getDescription(), lt.isActive());
    }

    // ── Leave Balances ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HrDtos.LeaveBalanceRow> listLeaveBalances(UUID hotelId, String hotelHeader, int year) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal current = tenantAccessService.currentUser();
        if (isHrManager(current)) {
            return leaveBalanceRepository.findByHotelAndYear(hotelId, year).stream()
                    .map(this::toLeaveBalanceRow)
                    .toList();
        }
        return leaveBalanceRepository.findByHotelUserAndYear(hotelId, current.getId(), year).stream()
                .map(this::toLeaveBalanceRow)
                .toList();
    }

    @Transactional
    public HrDtos.LeaveBalanceRow setLeaveBalance(UUID hotelId, String hotelHeader, HrDtos.SetLeaveBalanceRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
        AppUser user = appUserRepository.findById(req.userId())
                .filter(u -> u.getHotel() != null && u.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found"));
        HrLeaveType lt = leaveTypeRepository.findById(req.leaveTypeId())
                .filter(t -> t.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "LEAVE_TYPE_NOT_FOUND", "Leave type not found"));

        HrLeaveBalance balance = leaveBalanceRepository
                .findByHotelUserTypeAndYear(hotelId, req.userId(), req.leaveTypeId(), req.year())
                .orElseGet(() -> {
                    HrLeaveBalance b = new HrLeaveBalance();
                    b.setHotel(hotel);
                    b.setUser(user);
                    b.setLeaveType(lt);
                    b.setYear(req.year());
                    return b;
                });
        balance.setDaysAllocated(req.daysAllocated());
        return toLeaveBalanceRow(leaveBalanceRepository.save(balance));
    }

    private HrDtos.LeaveBalanceRow toLeaveBalanceRow(HrLeaveBalance b) {
        BigDecimal remaining = b.getDaysAllocated().subtract(b.getDaysUsed()).subtract(b.getDaysPending());
        return new HrDtos.LeaveBalanceRow(
                b.getId(), b.getUser().getId(), b.getUser().getUsername(),
                b.getLeaveType().getId(), b.getLeaveType().getName(), b.getLeaveType().isPaid(),
                b.getYear(), b.getDaysAllocated(), b.getDaysUsed(), b.getDaysPending(), remaining);
    }

    // ── Leave Requests ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HrDtos.LeaveRequestRow> listLeaveRequests(UUID hotelId, String hotelHeader, String status) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal current = tenantAccessService.currentUser();
        List<HrLeaveRequest> requests;
        if (isHrManager(current)) {
            requests = (status != null && !status.isBlank())
                    ? leaveRequestRepository.findByHotelIdAndStatus(hotelId, status.toUpperCase())
                    : leaveRequestRepository.findByHotelId(hotelId);
        } else {
            requests = leaveRequestRepository.findByHotelAndUser(hotelId, current.getId());
            if (status != null && !status.isBlank()) {
                String filterStatus = status.toUpperCase();
                requests = requests.stream()
                        .filter(r -> filterStatus.equals(r.getStatus()))
                        .toList();
            }
        }
        return requests.stream().map(this::toLeaveRequestRow).toList();
    }

    @Transactional
    public HrDtos.LeaveRequestRow submitLeaveRequest(UUID hotelId, String hotelHeader, HrDtos.CreateLeaveRequestRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
        UUID requesterId = tenantAccessService.currentUser().getId();
        AppUser user = appUserRepository.findById(requesterId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        HrLeaveType lt = leaveTypeRepository.findById(req.leaveTypeId())
                .filter(t -> t.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "LEAVE_TYPE_NOT_FOUND", "Leave type not found"));
        if (!lt.isActive()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "LEAVE_TYPE_INACTIVE", "This leave type is no longer available for new requests");
        }

        if (req.endDate().isBefore(req.startDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "End date must be on or after start date");
        }
        long days = req.startDate().datesUntil(req.endDate().plusDays(1)).count();

        HrLeaveRequest request = new HrLeaveRequest();
        request.setHotel(hotel);
        request.setUser(user);
        request.setLeaveType(lt);
        request.setStartDate(req.startDate());
        request.setEndDate(req.endDate());
        request.setTotalDays(BigDecimal.valueOf(days));
        request.setReason(req.reason());
        request.setStatus(PENDING);

        HrLeaveRequest saved = leaveRequestRepository.save(request);

        // bump pending balance
        int year = req.startDate().getYear();
        leaveBalanceRepository.findByHotelUserTypeAndYear(hotelId, requesterId, lt.getId(), year)
                .ifPresent(b -> {
                    b.setDaysPending(b.getDaysPending().add(BigDecimal.valueOf(days)));
                    leaveBalanceRepository.save(b);
                });

        return toLeaveRequestRow(saved);
    }

    @Transactional
    public HrDtos.LeaveRequestRow reviewLeaveRequest(UUID hotelId, String hotelHeader, UUID requestId, HrDtos.ReviewLeaveRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        HrLeaveRequest request = leaveRequestRepository.findById(requestId)
                .filter(r -> r.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "REQUEST_NOT_FOUND", "Leave request not found"));
        if (!PENDING.equals(request.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_REVIEWED", "Leave request has already been reviewed");
        }

        String reviewer = tenantAccessService.currentUser().getUsername();
        boolean approve = req.approve();
        request.setStatus(approve ? APPROVED : REJECTED);
        request.setReviewedBy(reviewer);
        request.setReviewedAt(Instant.now());
        request.setReviewNotes(req.reviewNotes());

        // adjust balances
        int year = request.getStartDate().getYear();
        BigDecimal days = request.getTotalDays();
        leaveBalanceRepository.findByHotelUserTypeAndYear(hotelId, request.getUser().getId(), request.getLeaveType().getId(), year)
                .ifPresent(b -> {
                    b.setDaysPending(b.getDaysPending().subtract(days).max(BigDecimal.ZERO));
                    if (approve) b.setDaysUsed(b.getDaysUsed().add(days));
                    leaveBalanceRepository.save(b);
                });

        return toLeaveRequestRow(leaveRequestRepository.save(request));
    }

    private HrDtos.LeaveRequestRow toLeaveRequestRow(HrLeaveRequest r) {
        return new HrDtos.LeaveRequestRow(
                r.getId(), r.getUser().getId(), r.getUser().getUsername(),
                r.getLeaveType().getId(), r.getLeaveType().getName(),
                r.getStartDate(), r.getEndDate(), r.getTotalDays(),
                r.getReason(), r.getStatus(), r.getReviewedBy(), r.getReviewedAt(),
                r.getReviewNotes(), r.getCreatedAt());
    }

    // ── Recruitment ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HrDtos.JobPositionRow> listJobPositions(UUID hotelId, String hotelHeader, String status) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<HrJobPosition> positions = (status != null && !status.isBlank())
                ? jobPositionRepository.findByHotel_IdAndStatusOrderByCreatedAtDesc(hotelId, status.toUpperCase())
                : jobPositionRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId);
        return positions.stream().map(p -> toJobPositionRow(p, candidateRepository.countByJobPosition_Id(p.getId()))).toList();
    }

    @Transactional
    public HrDtos.JobPositionRow createJobPosition(UUID hotelId, String hotelHeader, HrDtos.CreateJobPositionRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
        HrJobPosition pos = new HrJobPosition();
        pos.setHotel(hotel);
        pos.setTitle(req.title().trim());
        pos.setDepartment(req.department());
        pos.setDescription(req.description());
        pos.setRequirements(req.requirements());
        pos.setEmploymentType(req.employmentType() != null ? req.employmentType() : "FULL_TIME");
        pos.setLocation(req.location());
        pos.setStatus("OPEN");
        pos.setPostedDate(LocalDate.now());
        pos.setDeadlineDate(req.deadlineDate());
        return toJobPositionRow(jobPositionRepository.save(pos), 0L);
    }

    @Transactional
    public HrDtos.JobPositionRow updateJobPositionStatus(UUID hotelId, String hotelHeader, UUID positionId, HrDtos.UpdateJobPositionStatusRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        HrJobPosition pos = jobPositionRepository.findById(positionId)
                .filter(p -> p.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "POSITION_NOT_FOUND", "Job position not found"));
        pos.setStatus(req.status().toUpperCase());
        HrJobPosition saved = jobPositionRepository.save(pos);
        return toJobPositionRow(saved, candidateRepository.countByJobPosition_Id(saved.getId()));
    }

    private HrDtos.JobPositionRow toJobPositionRow(HrJobPosition p, long candidateCount) {
        return new HrDtos.JobPositionRow(
                p.getId(), p.getTitle(), p.getDepartment(), p.getDescription(),
                p.getRequirements(), p.getEmploymentType(), p.getLocation(),
                p.getStatus(), p.getPostedDate(), p.getDeadlineDate(), candidateCount);
    }

    @Transactional(readOnly = true)
    public List<HrDtos.CandidateRow> listCandidates(UUID hotelId, String hotelHeader, UUID positionId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<HrCandidate> candidates = (positionId != null)
                ? candidateRepository.findByHotelAndPosition(hotelId, positionId)
                : candidateRepository.findByHotelId(hotelId);
        return candidates.stream().map(this::toCandidateRow).toList();
    }

    @Transactional
    public HrDtos.CandidateRow createCandidate(UUID hotelId, String hotelHeader, HrDtos.CreateCandidateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));

        HrJobPosition pos = null;
        if (req.jobPositionId() != null) {
            pos = jobPositionRepository.findById(req.jobPositionId())
                    .filter(p -> p.getHotel().getId().equals(hotelId))
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "POSITION_NOT_FOUND", "Job position not found"));
        }

        HrCandidate candidate = new HrCandidate();
        candidate.setHotel(hotel);
        candidate.setJobPosition(pos);
        candidate.setFullName(req.fullName().trim());
        candidate.setEmail(req.email());
        candidate.setPhone(req.phone());
        candidate.setResumeUrl(req.resumeUrl());
        candidate.setCoverLetter(req.coverLetter());
        candidate.setStage("APPLIED");
        return toCandidateRow(candidateRepository.save(candidate));
    }

    @Transactional
    public HrDtos.CandidateRow advanceCandidateStage(UUID hotelId, String hotelHeader, UUID candidateId, HrDtos.AdvanceCandidateStageRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        HrCandidate candidate = candidateRepository.findById(candidateId)
                .filter(c -> c.getHotel().getId().equals(hotelId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CANDIDATE_NOT_FOUND", "Candidate not found"));
        candidate.setStage(req.stage().toUpperCase());
        candidate.setStageUpdatedAt(Instant.now());
        if (req.notes() != null) candidate.setNotes(req.notes());
        return toCandidateRow(candidateRepository.save(candidate));
    }

    private HrDtos.CandidateRow toCandidateRow(HrCandidate c) {
        HrJobPosition pos = c.getJobPosition();
        return new HrDtos.CandidateRow(
                c.getId(),
                pos != null ? pos.getId() : null,
                pos != null ? pos.getTitle() : null,
                c.getFullName(), c.getEmail(), c.getPhone(),
                c.getStage(), c.getAppliedDate(), c.getStageUpdatedAt(), c.getNotes());
    }

    private static boolean isHrManager(UserPrincipal user) {
        Role role = user.getRole();
        return role == Role.SUPER_ADMIN
                || role == Role.HOTEL_ADMIN
                || role == Role.MANAGER
                || role == Role.FINANCE;
    }

    private static BigDecimal coalesce(BigDecimal val) {
        return val != null ? val : BigDecimal.ZERO;
    }
}
