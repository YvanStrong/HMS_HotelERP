package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class DutyDtos {

    private DutyDtos() {}

    public record DutyShiftRow(
            UUID id,
            UUID userId,
            String username,
            String email,
            String role,
            LocalDate dutyDate,
            String shiftCode,
            LocalTime startTime,
            LocalTime endTime,
            String department,
            String location,
            String status,
            String notes,
            Instant checkedInAt,
            Instant checkedOutAt,
            Instant createdAt,
            Instant updatedAt) {}

    public record DutySummary(
            LocalDate date,
            long total,
            long scheduled,
            long onDuty,
            long completed,
            long absent,
            long cancelled,
            long noShow) {}

    public record CreateDutyShiftRequest(
            @NotNull UUID userId,
            @NotNull LocalDate dutyDate,
            @NotBlank String shiftCode,
            LocalTime startTime,
            LocalTime endTime,
            String department,
            String location,
            String notes) {}

    public record UpdateDutyShiftRequest(
            LocalDate dutyDate,
            String shiftCode,
            LocalTime startTime,
            LocalTime endTime,
            String department,
            String location,
            String notes) {}

    public record UpdateDutyStatusRequest(@NotBlank String status, String notes) {}
}
