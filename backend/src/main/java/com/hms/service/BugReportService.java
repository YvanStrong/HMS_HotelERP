package com.hms.service;

import com.hms.api.dto.BugReportDtos;
import com.hms.domain.BugReportSeverity;
import com.hms.domain.BugReportStatus;
import com.hms.entity.AppUser;
import com.hms.entity.BugReport;
import com.hms.repository.AppUserRepository;
import com.hms.repository.BugReportRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class BugReportService {

    private final BugReportRepository bugReportRepository;
    private final AppUserRepository appUserRepository;
    private final TenantAccessService tenantAccessService;
    private final BugReportEmailService bugReportEmailService;

    @Transactional
    public BugReportDtos.BugReportResponse submit(BugReportDtos.CreateBugReportRequest body) {
        UserPrincipal principal = tenantAccessService.currentUser();
        AppUser user = appUserRepository
                .findByIdWithHotel(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        BugReport report = new BugReport();
        report.setReporterUserId(user.getId());
        report.setHotelId(user.getHotel() != null ? user.getHotel().getId() : principal.getHotelId());
        report.setReporterUsername(user.getUsername());
        report.setReporterEmail(user.getEmail());
        report.setReporterRole(user.getRole() != null ? user.getRole().name() : principal.getRole().name());
        report.setPageUrl(trimToNull(body.pageUrl()));
        report.setTitle(body.title().trim());
        report.setDescription(body.description().trim());
        report.setSeverity(body.severity() != null ? body.severity() : BugReportSeverity.MEDIUM);
        report.setStatus(BugReportStatus.OPEN);

        BugReport saved = bugReportRepository.save(report);
        try {
            bugReportEmailService.sendBugReport(saved);
            saved.setEmailSent(true);
            saved.setEmailError(null);
        } catch (Exception ex) {
            log.warn("Failed to email bug report {}: {}", saved.getId(), ex.getMessage());
            saved.setEmailSent(false);
            String msg = ex.getMessage() == null ? "email_failed" : ex.getMessage();
            saved.setEmailError(msg.length() > 500 ? msg.substring(0, 500) : msg);
        }
        return toResponse(bugReportRepository.save(saved));
    }

    @Transactional(readOnly = true)
    public List<BugReportDtos.BugReportResponse> listForAdmin(BugReportStatus status) {
        List<BugReport> rows =
                status == null
                        ? bugReportRepository.findAllByOrderByCreatedAtDesc()
                        : bugReportRepository.findByStatusOrderByCreatedAtDesc(status);
        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BugReportDtos.BugReportResponse getForAdmin(UUID id) {
        return toResponse(require(id));
    }

    @Transactional
    public BugReportDtos.BugReportResponse updateForAdmin(UUID id, BugReportDtos.UpdateBugReportRequest body) {
        BugReport report = require(id);
        if (body.status() != null) {
            report.setStatus(body.status());
            if (body.status() == BugReportStatus.RESOLVED
                    || body.status() == BugReportStatus.CLOSED
                    || body.status() == BugReportStatus.WONT_FIX) {
                if (report.getResolvedAt() == null) {
                    report.setResolvedAt(Instant.now());
                }
            } else {
                report.setResolvedAt(null);
            }
        }
        if (body.adminNotes() != null) {
            report.setAdminNotes(body.adminNotes().isBlank() ? null : body.adminNotes().trim());
        }
        return toResponse(bugReportRepository.save(report));
    }

    private BugReport require(UUID id) {
        return bugReportRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug report not found"));
    }

    private BugReportDtos.BugReportResponse toResponse(BugReport r) {
        return new BugReportDtos.BugReportResponse(
                r.getId(),
                r.getReporterUserId(),
                r.getHotelId(),
                r.getReporterUsername(),
                r.getReporterEmail(),
                r.getReporterRole(),
                r.getPageUrl(),
                r.getTitle(),
                r.getDescription(),
                r.getSeverity(),
                r.getStatus(),
                r.getAdminNotes(),
                r.isEmailSent(),
                r.getEmailError(),
                r.getCreatedAt(),
                r.getUpdatedAt(),
                r.getResolvedAt());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}
