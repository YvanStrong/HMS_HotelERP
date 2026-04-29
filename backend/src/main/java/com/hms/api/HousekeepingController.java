package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.entity.HousekeepingTask;
import com.hms.security.UserPrincipal;
import com.hms.service.HousekeepingTaskService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/housekeeping")
public class HousekeepingController {

    private final HousekeepingTaskService housekeepingTaskService;

    public HousekeepingController(HousekeepingTaskService housekeepingTaskService) {
        this.housekeepingTaskService = housekeepingTaskService;
    }

    @GetMapping("/tasks")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingBoardResponse board(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return housekeepingTaskService.getBoard(hotelId, hotelHeader);
    }

    @GetMapping("/tasks/my")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public List<ApiDtos.HousekeepingBoardTask> myTasks(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            Authentication auth) {
        UserPrincipal p = (UserPrincipal) auth.getPrincipal();
        return housekeepingTaskService.getMyTasks(hotelId, hotelHeader, p.getId());
    }

    @GetMapping("/assignable-staff")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public List<ApiDtos.HousekeepingStaffOption> assignableStaff(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        return housekeepingTaskService.listAssignableStaff(hotelId, hotelHeader);
    }

    @PostMapping("/tasks")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingBoardTask createTask(
            @PathVariable UUID hotelId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.HousekeepingTaskCreateRequest body) {
        HousekeepingTask t = housekeepingTaskService.createTaskFromRequest(hotelId, hotelHeader, body);
        return housekeepingTaskService.toBoardTaskDto(t);
    }

    @PatchMapping("/tasks/{taskId}/assign")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingBoardTask assign(
            @PathVariable UUID hotelId,
            @PathVariable UUID taskId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.HousekeepingAssignRequest body) {
        HousekeepingTask t = housekeepingTaskService.assignTask(hotelId, hotelHeader, taskId, body.assignedTo());
        return housekeepingTaskService.toBoardTaskDto(t);
    }

    @PatchMapping("/tasks/{taskId}/start")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingBoardTask start(
            @PathVariable UUID hotelId,
            @PathVariable UUID taskId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        HousekeepingTask t = housekeepingTaskService.startTask(hotelId, hotelHeader, taskId);
        return housekeepingTaskService.toBoardTaskDto(t);
    }

    @PatchMapping("/tasks/{taskId}/complete")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingBoardTask complete(
            @PathVariable UUID hotelId,
            @PathVariable UUID taskId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @RequestBody(required = false) ApiDtos.HousekeepingCompleteRequest body) {
        ApiDtos.HousekeepingCompleteRequest b =
                body != null ? body : new ApiDtos.HousekeepingCompleteRequest(null, null, null);
        HousekeepingTask t = housekeepingTaskService.completeTask(
                hotelId,
                hotelHeader,
                taskId,
                b.notes(),
                b.photoUrl(),
                Boolean.TRUE.equals(b.checklistCompleted()));
        return housekeepingTaskService.toBoardTaskDto(t);
    }

    @PatchMapping("/tasks/{taskId}/inspect")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingBoardTask inspect(
            @PathVariable UUID hotelId,
            @PathVariable UUID taskId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader,
            @Valid @RequestBody ApiDtos.HousekeepingInspectRequest body) {
        HousekeepingTask t = housekeepingTaskService.inspectTask(hotelId, hotelHeader, taskId, body.score());
        return housekeepingTaskService.toBoardTaskDto(t);
    }

    @PatchMapping("/tasks/{taskId}/skip-dnd")
    @PreAuthorize(
            "hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_HOUSEKEEPING','ROLE_HOUSEKEEPING_SUPERVISOR')")
    public ApiDtos.HousekeepingBoardTask skipDnd(
            @PathVariable UUID hotelId,
            @PathVariable UUID taskId,
            @RequestHeader(value = "X-Hotel-ID", required = false) String hotelHeader) {
        HousekeepingTask t = housekeepingTaskService.skipDndTask(hotelId, hotelHeader, taskId);
        return housekeepingTaskService.toBoardTaskDto(t);
    }
}
