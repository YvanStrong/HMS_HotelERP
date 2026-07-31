package com.hms.api.dto;

import com.hms.domain.BugReportSeverity;
import com.hms.domain.BugReportStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class BugReportDtos {

    private BugReportDtos() {}

    public record CreateBugReportRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 8000) String description,
            BugReportSeverity severity,
            @Size(max = 1024) String pageUrl,
            /** Optional {@code data:image/...;base64,...} screenshot (max ~2.5MB decoded). */
            String screenshotDataUrl,
            @Size(max = 255) String screenshotFileName) {}

    public record UpdateBugReportRequest(BugReportStatus status, @Size(max = 8000) String adminNotes) {}

    public record BugReportResponse(
            UUID id,
            UUID reporterUserId,
            UUID hotelId,
            String reporterUsername,
            String reporterEmail,
            String reporterRole,
            String pageUrl,
            String title,
            String description,
            BugReportSeverity severity,
            BugReportStatus status,
            String adminNotes,
            boolean emailSent,
            String emailError,
            boolean hasScreenshot,
            String screenshotFileName,
            String screenshotContentType,
            /** Present on detail fetch; omitted from list payloads to keep responses light. */
            String screenshotDataUrl,
            Instant createdAt,
            Instant updatedAt,
            Instant resolvedAt) {}
}
