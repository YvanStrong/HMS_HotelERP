package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class HrDtos {

    private HrDtos() {}

    // ── Employees ──────────────────────────────────────────────────────────

    public record EmployeeRow(
            UUID id,
            UUID userId,
            String username,
            String email,
            String role,
            boolean isActive,
            String department,
            String jobTitle,
            String employmentType,
            String employmentStatus,
            LocalDate hireDate,
            BigDecimal baseSalary,
            String salaryCurrency,
            String phone,
            String address,
            String nationalId,
            String emergencyContactName,
            String emergencyContactPhone,
            String notes,
            boolean hasHrProfile) {}

    public record UpdateEmployeeProfileRequest(
            String department,
            String jobTitle,
            String employmentType,
            String employmentStatus,
            LocalDate hireDate,
            BigDecimal baseSalary,
            String salaryCurrency,
            String phone,
            String address,
            String nationalId,
            String emergencyContactName,
            String emergencyContactPhone,
            String notes) {}

    // ── Payroll ────────────────────────────────────────────────────────────

    public record PayrollRecordRow(
            UUID id,
            UUID userId,
            String username,
            String department,
            int periodYear,
            int periodMonth,
            BigDecimal basePay,
            BigDecimal bonus,
            BigDecimal overtimePay,
            BigDecimal benefits,
            BigDecimal deductions,
            BigDecimal netPay,
            String currency,
            String status,
            String approvedBy,
            Instant approvedAt,
            Instant paidAt,
            String notes,
            Instant createdAt) {}

    public record CreatePayrollRecordRequest(
            @NotNull UUID userId,
            @NotNull Integer periodYear,
            @NotNull Integer periodMonth,
            @NotNull BigDecimal basePay,
            BigDecimal bonus,
            BigDecimal overtimePay,
            BigDecimal benefits,
            BigDecimal deductions,
            String currency,
            String notes) {}

    public record ReviewPayrollRequest(boolean approve, String notes) {}

    // ── Leave Types ────────────────────────────────────────────────────────

    public record LeaveTypeRow(
            UUID id,
            String name,
            int annualDaysAllowed,
            boolean isPaid,
            String description,
            boolean isActive) {}

    public record CreateLeaveTypeRequest(
            @NotBlank String name,
            @NotNull Integer annualDaysAllowed,
            boolean isPaid,
            String description) {}

    // ── Leave Balances ─────────────────────────────────────────────────────

    public record LeaveBalanceRow(
            UUID id,
            UUID userId,
            String username,
            UUID leaveTypeId,
            String leaveTypeName,
            boolean isPaidLeave,
            int year,
            BigDecimal daysAllocated,
            BigDecimal daysUsed,
            BigDecimal daysPending,
            BigDecimal daysRemaining) {}

    public record SetLeaveBalanceRequest(
            @NotNull UUID userId,
            @NotNull UUID leaveTypeId,
            @NotNull Integer year,
            @NotNull BigDecimal daysAllocated) {}

    // ── Leave Requests ─────────────────────────────────────────────────────

    public record LeaveRequestRow(
            UUID id,
            UUID userId,
            String username,
            UUID leaveTypeId,
            String leaveTypeName,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal totalDays,
            String reason,
            String status,
            String reviewedBy,
            Instant reviewedAt,
            String reviewNotes,
            Instant createdAt) {}

    public record CreateLeaveRequestRequest(
            @NotNull UUID leaveTypeId,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            String reason) {}

    public record ReviewLeaveRequest(boolean approve, String reviewNotes) {}

    // ── Recruitment ────────────────────────────────────────────────────────

    public record JobPositionRow(
            UUID id,
            String title,
            String department,
            String description,
            String requirements,
            String employmentType,
            String location,
            String status,
            LocalDate postedDate,
            LocalDate deadlineDate,
            long candidateCount) {}

    public record CreateJobPositionRequest(
            @NotBlank String title,
            String department,
            String description,
            String requirements,
            String employmentType,
            String location,
            LocalDate deadlineDate) {}

    public record UpdateJobPositionStatusRequest(@NotBlank String status) {}

    public record CandidateRow(
            UUID id,
            UUID jobPositionId,
            String jobTitle,
            String fullName,
            String email,
            String phone,
            String stage,
            LocalDate appliedDate,
            Instant stageUpdatedAt,
            String notes) {}

    public record CreateCandidateRequest(
            UUID jobPositionId,
            @NotBlank String fullName,
            String email,
            String phone,
            String resumeUrl,
            String coverLetter) {}

    public record AdvanceCandidateStageRequest(@NotBlank String stage, String notes) {}

    // ── Summary dashboard ──────────────────────────────────────────────────

    public record HrDashboard(
            long totalEmployees,
            long activeEmployees,
            long onLeaveEmployees,
            long remoteEmployees,
            long pendingLeaveRequests,
            long openPositions,
            long totalCandidates) {}
}
