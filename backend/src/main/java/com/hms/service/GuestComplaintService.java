package com.hms.service;

import com.hms.api.dto.GuestDtos;
import com.hms.domain.GuestComplaintSeverity;
import com.hms.domain.GuestComplaintStatus;
import com.hms.entity.AppUser;
import com.hms.entity.Guest;
import com.hms.entity.GuestComplaint;
import com.hms.entity.Hotel;
import com.hms.entity.Reservation;
import com.hms.repository.AppUserRepository;
import com.hms.repository.GuestComplaintRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.ReservationRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GuestComplaintService {

    public static final EnumSet<GuestComplaintStatus> OPEN_WORKFLOW_STATUSES =
            EnumSet.of(GuestComplaintStatus.OPEN, GuestComplaintStatus.IN_PROGRESS, GuestComplaintStatus.ESCALATED);

    private final GuestComplaintRepository guestComplaintRepository;
    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;
    private final AppUserRepository appUserRepository;
    private final TenantAccessService tenantAccessService;

    public GuestComplaintService(
            GuestComplaintRepository guestComplaintRepository,
            GuestRepository guestRepository,
            ReservationRepository reservationRepository,
            AppUserRepository appUserRepository,
            TenantAccessService tenantAccessService) {
        this.guestComplaintRepository = guestComplaintRepository;
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.appUserRepository = appUserRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional
    public GuestDtos.OperationalComplaintRow create(
            UUID hotelId, String hotelHeader, GuestDtos.OperationalComplaintCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Guest guest =
                guestRepository.findByIdAndHotel_Id(req.guestId(), hotelId).orElseThrow(() -> notFound("Guest"));
        Reservation res = reservationRepository
                .findByIdAndHotel_Id(req.reservationId(), hotelId)
                .orElseThrow(() -> notFound("Reservation"));
        if (!res.getGuest().getId().equals(guest.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Reservation does not belong to this guest");
        }
        GuestComplaintSeverity sev = parseSeverity(req.severity());
        AppUser assignee = req.assignedTo() != null ? resolveAssignee(hotelId, req.assignedTo()) : null;
        if (sev == GuestComplaintSeverity.CRITICAL && assignee == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CRITICAL complaints require assignedTo");
        }
        GuestComplaint c = new GuestComplaint();
        c.setHotel(guest.getHotel());
        c.setGuest(guest);
        c.setReservation(res);
        c.setType(req.type().trim());
        c.setSeverity(sev);
        c.setDescription(req.description().trim());
        c.setAssignedTo(assignee);
        c.setStatus(assignee != null ? GuestComplaintStatus.IN_PROGRESS : GuestComplaintStatus.OPEN);
        c.setOpenedAt(Instant.now());
        c = guestComplaintRepository.save(c);
        return toRow(c);
    }

    @Transactional(readOnly = true)
    public List<GuestDtos.OperationalComplaintRow> list(
            UUID hotelId, String hotelHeader, GuestComplaintStatus status, GuestComplaintSeverity severity, int limit) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        int cap = Math.min(Math.max(limit, 1), 500);
        List<GuestComplaint> rows =
                guestComplaintRepository.findByHotel_IdOrderByOpenedAtDesc(hotelId, PageRequest.of(0, cap));
        return rows.stream()
                .filter(c -> status == null || c.getStatus() == status)
                .filter(c -> severity == null || c.getSeverity() == severity)
                .map(this::toRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public GuestDtos.OperationalComplaintRow get(UUID hotelId, String hotelHeader, UUID id) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GuestComplaint c = guestComplaintRepository
                .findByIdAndHotel_Id(id, hotelId)
                .orElseThrow(() -> notFound("Complaint"));
        return toRow(c);
    }

    @Transactional
    public GuestDtos.OperationalComplaintRow patch(
            UUID hotelId, String hotelHeader, UUID id, GuestDtos.OperationalComplaintPatchRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GuestComplaint c = guestComplaintRepository
                .findByIdAndHotel_Id(id, hotelId)
                .orElseThrow(() -> notFound("Complaint"));
        if (req.type() != null && !req.type().isBlank()) {
            c.setType(req.type().trim());
        }
        if (req.severity() != null && !req.severity().isBlank()) {
            c.setSeverity(parseSeverity(req.severity()));
        }
        if (req.status() != null && !req.status().isBlank()) {
            GuestComplaintStatus next = parseStatus(req.status());
            c.setStatus(next);
            if (next == GuestComplaintStatus.RESOLVED || next == GuestComplaintStatus.CLOSED) {
                if (c.getResolvedAt() == null) {
                    c.setResolvedAt(Instant.now());
                }
            } else {
                c.setResolvedAt(null);
            }
        }
        if (Boolean.TRUE.equals(req.clearAssignee())) {
            c.setAssignedTo(null);
        } else if (req.assignedTo() != null) {
            c.setAssignedTo(resolveAssignee(hotelId, req.assignedTo()));
        }
        if (req.resolution() != null) {
            c.setResolution(req.resolution().isBlank() ? null : req.resolution().trim());
        }
        assertCriticalAssigned(c);
        c = guestComplaintRepository.save(c);
        return toRow(c);
    }

    @Transactional
    public GuestDtos.OperationalComplaintRow assign(
            UUID hotelId, String hotelHeader, UUID id, GuestDtos.OperationalComplaintAssignRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GuestComplaint c = guestComplaintRepository
                .findByIdAndHotel_Id(id, hotelId)
                .orElseThrow(() -> notFound("Complaint"));
        c.setAssignedTo(resolveAssignee(hotelId, req.assignedTo()));
        if (c.getStatus() == GuestComplaintStatus.OPEN) {
            c.setStatus(GuestComplaintStatus.IN_PROGRESS);
        }
        assertCriticalAssigned(c);
        c = guestComplaintRepository.save(c);
        return toRow(c);
    }

    private void assertCriticalAssigned(GuestComplaint c) {
        if (c.getSeverity() == GuestComplaintSeverity.CRITICAL
                && OPEN_WORKFLOW_STATUSES.contains(c.getStatus())
                && c.getAssignedTo() == null) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY, "CRITICAL complaint must have an assignee while unresolved");
        }
    }

    private AppUser resolveAssignee(UUID hotelId, UUID userId) {
        AppUser u = appUserRepository.findById(userId).orElseThrow(() -> notFound("Staff user"));
        Hotel h = u.getHotel();
        if (h == null || !h.getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Assignee must belong to this hotel");
        }
        return u;
    }

    private static GuestComplaintSeverity parseSeverity(String raw) {
        try {
            return GuestComplaintSeverity.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid severity");
        }
    }

    private static GuestComplaintStatus parseStatus(String raw) {
        try {
            return GuestComplaintStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid status");
        }
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }

    private GuestDtos.OperationalComplaintRow toRow(GuestComplaint c) {
        Guest g = c.getGuest();
        Reservation r = c.getReservation();
        AppUser a = c.getAssignedTo();
        String guestName = g.getFirstName() + " " + g.getLastName();
        return new GuestDtos.OperationalComplaintRow(
                c.getId(),
                g.getId(),
                guestName,
                r.getId(),
                r.getBookingReference(),
                c.getType(),
                c.getSeverity().name(),
                c.getStatus().name(),
                a != null ? a.getId() : null,
                a != null ? a.getUsername() : null,
                c.getDescription(),
                c.getResolution(),
                c.getOpenedAt(),
                c.getResolvedAt());
    }
}
