package com.hms.service;

import com.hms.api.dto.DutyDtos;
import com.hms.domain.DutyShiftCode;
import com.hms.domain.DutyShiftStatus;
import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.entity.HrDutyShift;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.HrDutyShiftRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DutyRosterService {

    private final TenantAccessService tenantAccessService;
    private final HotelRepository hotelRepository;
    private final AppUserRepository appUserRepository;
    private final HrDutyShiftRepository dutyShiftRepository;

    public DutyRosterService(
            TenantAccessService tenantAccessService,
            HotelRepository hotelRepository,
            AppUserRepository appUserRepository,
            HrDutyShiftRepository dutyShiftRepository) {
        this.tenantAccessService = tenantAccessService;
        this.hotelRepository = hotelRepository;
        this.appUserRepository = appUserRepository;
        this.dutyShiftRepository = dutyShiftRepository;
    }

    @Transactional(readOnly = true)
    public List<DutyDtos.DutyShiftRow> list(
            UUID hotelId,
            String hotelHeader,
            LocalDate from,
            LocalDate to,
            String shift,
            String status,
            UUID userId) {
        assertAccess(hotelId, hotelHeader);
        LocalDate today = LocalDate.now();
        LocalDate fromDate = from != null ? from : today.minusDays(30);
        LocalDate toDate = to != null ? to : today.plusDays(14);
        if (toDate.isBefore(fromDate)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RANGE", "to must be on or after from");
        }
        return dutyShiftRepository
                .search(hotelId, fromDate, toDate, parseShiftOptional(shift), parseStatusOptional(status), userId)
                .stream()
                .map(this::toRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public DutyDtos.DutySummary summary(UUID hotelId, String hotelHeader, LocalDate date) {
        assertAccess(hotelId, hotelHeader);
        LocalDate day = date != null ? date : LocalDate.now();
        List<HrDutyShift> rows = dutyShiftRepository.search(hotelId, day, day, null, null, null);
        long scheduled = rows.stream().filter(r -> r.getStatus() == DutyShiftStatus.SCHEDULED).count();
        long onDuty = rows.stream().filter(r -> r.getStatus() == DutyShiftStatus.ON_DUTY).count();
        long completed = rows.stream().filter(r -> r.getStatus() == DutyShiftStatus.COMPLETED).count();
        long absent = rows.stream().filter(r -> r.getStatus() == DutyShiftStatus.ABSENT).count();
        long cancelled = rows.stream().filter(r -> r.getStatus() == DutyShiftStatus.CANCELLED).count();
        long noShow = rows.stream().filter(r -> r.getStatus() == DutyShiftStatus.NO_SHOW).count();
        return new DutyDtos.DutySummary(day, rows.size(), scheduled, onDuty, completed, absent, cancelled, noShow);
    }

    @Transactional
    public DutyDtos.DutyShiftRow create(UUID hotelId, String hotelHeader, DutyDtos.CreateDutyShiftRequest body) {
        UserPrincipal actor = assertAccess(hotelId, hotelHeader);
        Hotel hotel = mustHotel(hotelId);
        AppUser staff = mustHotelStaff(hotelId, body.userId());
        DutyShiftCode shift = parseShiftRequired(body.shiftCode());
        LocalTime[] window = resolveWindow(shift, body.startTime(), body.endTime());

        HrDutyShift row = new HrDutyShift();
        row.setHotel(hotel);
        row.setUser(staff);
        row.setDutyDate(body.dutyDate());
        row.setShiftCode(shift);
        row.setStartTime(window[0]);
        row.setEndTime(window[1]);
        row.setDepartment(trimOrNull(body.department()));
        row.setLocation(trimOrNull(body.location()));
        row.setNotes(trimOrNull(body.notes()));
        row.setStatus(DutyShiftStatus.SCHEDULED);
        row.setCreatedBy(actor.getId());
        row.setUpdatedBy(actor.getId());
        return toRow(dutyShiftRepository.save(row));
    }

    @Transactional
    public DutyDtos.DutyShiftRow update(
            UUID hotelId, String hotelHeader, UUID dutyId, DutyDtos.UpdateDutyShiftRequest body) {
        UserPrincipal actor = assertAccess(hotelId, hotelHeader);
        HrDutyShift row = mustDuty(hotelId, dutyId);
        if (row.getStatus() == DutyShiftStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "DUTY_CANCELLED", "Cancelled duties cannot be edited.");
        }
        if (body.dutyDate() != null) {
            row.setDutyDate(body.dutyDate());
        }
        if (body.shiftCode() != null && !body.shiftCode().isBlank()) {
            DutyShiftCode shift = parseShiftRequired(body.shiftCode());
            row.setShiftCode(shift);
            LocalTime[] window = resolveWindow(shift, body.startTime(), body.endTime());
            row.setStartTime(window[0]);
            row.setEndTime(window[1]);
        } else if (body.startTime() != null || body.endTime() != null) {
            row.setStartTime(body.startTime() != null ? body.startTime() : row.getStartTime());
            row.setEndTime(body.endTime() != null ? body.endTime() : row.getEndTime());
            row.setShiftCode(DutyShiftCode.CUSTOM);
        }
        if (body.department() != null) row.setDepartment(trimOrNull(body.department()));
        if (body.location() != null) row.setLocation(trimOrNull(body.location()));
        if (body.notes() != null) row.setNotes(trimOrNull(body.notes()));
        row.setUpdatedBy(actor.getId());
        return toRow(dutyShiftRepository.save(row));
    }

    @Transactional
    public DutyDtos.DutyShiftRow updateStatus(
            UUID hotelId, String hotelHeader, UUID dutyId, DutyDtos.UpdateDutyStatusRequest body) {
        UserPrincipal actor = assertAccess(hotelId, hotelHeader);
        HrDutyShift row = mustDuty(hotelId, dutyId);
        DutyShiftStatus next = parseStatusRequired(body.status());
        DutyShiftStatus current = row.getStatus();
        if (current == DutyShiftStatus.CANCELLED && next != DutyShiftStatus.SCHEDULED) {
            throw new ApiException(HttpStatus.CONFLICT, "DUTY_CANCELLED", "Reactivate a cancelled duty as SCHEDULED first.");
        }
        Instant now = Instant.now();
        switch (next) {
            case ON_DUTY -> {
                if (current != DutyShiftStatus.SCHEDULED && current != DutyShiftStatus.ON_DUTY) {
                    throw new ApiException(HttpStatus.CONFLICT, "INVALID_TRANSITION", "Only scheduled duties can be marked on duty.");
                }
                if (row.getCheckedInAt() == null) row.setCheckedInAt(now);
            }
            case COMPLETED -> {
                if (current != DutyShiftStatus.ON_DUTY && current != DutyShiftStatus.SCHEDULED) {
                    throw new ApiException(HttpStatus.CONFLICT, "INVALID_TRANSITION", "Complete from scheduled or on-duty status.");
                }
                if (row.getCheckedInAt() == null) row.setCheckedInAt(now);
                row.setCheckedOutAt(now);
            }
            case ABSENT, NO_SHOW, CANCELLED, SCHEDULED -> {
                // allowed from most states for ops correction
            }
            default -> {}
        }
        row.setStatus(next);
        if (body.notes() != null) {
            row.setNotes(trimOrNull(body.notes()));
        }
        row.setUpdatedBy(actor.getId());
        return toRow(dutyShiftRepository.save(row));
    }

    private UserPrincipal assertAccess(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return tenantAccessService.currentUser();
    }

    private Hotel mustHotel(UUID hotelId) {
        return hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found"));
    }

    private AppUser mustHotelStaff(UUID hotelId, UUID userId) {
        AppUser user = appUserRepository
                .findByIdWithHotel(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Staff user not found"));
        if (user.getHotel() == null || !hotelId.equals(user.getHotel().getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "USER_NOT_IN_HOTEL", "User does not belong to this hotel");
        }
        if (user.getRole() == Role.GUEST || user.getRole() == Role.CORPORATE_BOOKER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOT_STAFF", "Only hotel staff can be assigned to duty shifts");
        }
        if (!user.isActive()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "USER_INACTIVE", "Cannot schedule an inactive staff user");
        }
        return user;
    }

    private HrDutyShift mustDuty(UUID hotelId, UUID dutyId) {
        return dutyShiftRepository
                .findByIdAndHotel_Id(dutyId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DUTY_NOT_FOUND", "Duty shift not found"));
    }

    private DutyDtos.DutyShiftRow toRow(HrDutyShift row) {
        AppUser user = row.getUser();
        return new DutyDtos.DutyShiftRow(
                row.getId(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole() != null ? user.getRole().name() : null,
                row.getDutyDate(),
                row.getShiftCode().name(),
                row.getStartTime(),
                row.getEndTime(),
                row.getDepartment(),
                row.getLocation(),
                row.getStatus().name(),
                row.getNotes(),
                row.getCheckedInAt(),
                row.getCheckedOutAt(),
                row.getCreatedAt(),
                row.getUpdatedAt());
    }

    private static LocalTime[] resolveWindow(DutyShiftCode shift, LocalTime start, LocalTime end) {
        return switch (shift) {
            case MORNING -> new LocalTime[] {
                start != null ? start : LocalTime.of(6, 0), end != null ? end : LocalTime.of(14, 0)
            };
            case AFTERNOON -> new LocalTime[] {
                start != null ? start : LocalTime.of(14, 0), end != null ? end : LocalTime.of(22, 0)
            };
            case NIGHT -> new LocalTime[] {
                start != null ? start : LocalTime.of(22, 0), end != null ? end : LocalTime.of(6, 0)
            };
            case CUSTOM -> {
                if (start == null || end == null) {
                    throw new ApiException(
                            HttpStatus.BAD_REQUEST, "CUSTOM_TIMES_REQUIRED", "Custom shifts require startTime and endTime");
                }
                yield new LocalTime[] {start, end};
            }
        };
    }

    private static DutyShiftCode parseShiftRequired(String raw) {
        try {
            return DutyShiftCode.valueOf(raw.trim().toUpperCase());
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SHIFT", "shiftCode must be MORNING, AFTERNOON, NIGHT, or CUSTOM");
        }
    }

    private static DutyShiftCode parseShiftOptional(String raw) {
        if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw.trim())) return null;
        return parseShiftRequired(raw);
    }

    private static DutyShiftStatus parseStatusRequired(String raw) {
        try {
            return DutyShiftStatus.valueOf(raw.trim().toUpperCase());
        } catch (Exception ex) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_STATUS",
                    "status must be SCHEDULED, ON_DUTY, COMPLETED, ABSENT, CANCELLED, or NO_SHOW");
        }
    }

    private static DutyShiftStatus parseStatusOptional(String raw) {
        if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw.trim())) return null;
        return parseStatusRequired(raw);
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}
