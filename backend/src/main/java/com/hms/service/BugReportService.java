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
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

    private static final int MAX_SCREENSHOT_BYTES = 2_500_000;
    private static final Pattern DATA_URL =
            Pattern.compile("^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", Pattern.DOTALL);

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
        applyScreenshot(report, body.screenshotDataUrl(), body.screenshotFileName());

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
        return toResponse(bugReportRepository.save(saved), true);
    }

    @Transactional(readOnly = true)
    public List<BugReportDtos.BugReportResponse> listForAdmin(BugReportStatus status) {
        List<BugReport> rows =
                status == null
                        ? bugReportRepository.findAllByOrderByCreatedAtDesc()
                        : bugReportRepository.findByStatusOrderByCreatedAtDesc(status);
        return rows.stream().map(r -> toResponse(r, false)).toList();
    }

    @Transactional(readOnly = true)
    public BugReportDtos.BugReportResponse getForAdmin(UUID id) {
        return toResponse(require(id), true);
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
        return toResponse(bugReportRepository.save(report), true);
    }

    private void applyScreenshot(BugReport report, String dataUrl, String fileName) {
        if (dataUrl == null || dataUrl.isBlank()) {
            return;
        }
        String trimmed = dataUrl.trim();
        Matcher m = DATA_URL.matcher(trimmed);
        if (!m.matches()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Screenshot must be a data:image/*;base64 URL");
        }
        String contentType = m.group(1).toLowerCase(Locale.ROOT);
        String b64 = m.group(2).replaceAll("\\s+", "");
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(b64);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid screenshot encoding");
        }
        if (bytes.length == 0) {
            return;
        }
        if (bytes.length > MAX_SCREENSHOT_BYTES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Screenshot must be under 2.5MB");
        }
        report.setScreenshotData(trimmed);
        report.setScreenshotContentType(contentType);
        String name = trimToNull(fileName);
        if (name == null) {
            String ext = contentType.contains("png")
                    ? "png"
                    : contentType.contains("webp")
                            ? "webp"
                            : contentType.contains("gif") ? "gif" : "jpg";
            name = "bug-screenshot." + ext;
        }
        report.setScreenshotFileName(name.length() > 255 ? name.substring(0, 255) : name);
    }

    private BugReport require(UUID id) {
        return bugReportRepository
                .findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug report not found"));
    }

    private BugReportDtos.BugReportResponse toResponse(BugReport r, boolean includeScreenshot) {
        boolean has = r.getScreenshotData() != null && !r.getScreenshotData().isBlank();
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
                has,
                r.getScreenshotFileName(),
                r.getScreenshotContentType(),
                includeScreenshot && has ? r.getScreenshotData() : null,
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
