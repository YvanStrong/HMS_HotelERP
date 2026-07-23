package com.hms.api;

import com.hms.api.dto.BugReportDtos;
import com.hms.domain.BugReportStatus;
import com.hms.service.BugReportService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class BugReportController {

    private final BugReportService bugReportService;

    public BugReportController(BugReportService bugReportService) {
        this.bugReportService = bugReportService;
    }

    /** Any authenticated staff/guest user can submit a bug report. */
    @PostMapping("/bug-reports")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BugReportDtos.BugReportResponse> submit(
            @Valid @RequestBody BugReportDtos.CreateBugReportRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(bugReportService.submit(body));
    }

    @GetMapping("/platform/bug-reports")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public List<BugReportDtos.BugReportResponse> list(
            @RequestParam(required = false) BugReportStatus status) {
        return bugReportService.listForAdmin(status);
    }

    @GetMapping("/platform/bug-reports/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public BugReportDtos.BugReportResponse get(@PathVariable UUID id) {
        return bugReportService.getForAdmin(id);
    }

    @PatchMapping("/platform/bug-reports/{id}")
    @PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
    public BugReportDtos.BugReportResponse update(
            @PathVariable UUID id, @RequestBody BugReportDtos.UpdateBugReportRequest body) {
        return bugReportService.updateForAdmin(id, body);
    }
}
