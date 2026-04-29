package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.CleanlinessStatus;
import com.hms.domain.HousekeepingTaskPriority;
import com.hms.domain.HousekeepingTaskStatus;
import com.hms.domain.HousekeepingTaskType;
import com.hms.domain.Role;
import com.hms.domain.RoomStatus;
import com.hms.entity.AppUser;
import com.hms.entity.HousekeepingTask;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HousekeepingTaskRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HousekeepingTaskService {

    private static final EnumSet<HousekeepingTaskStatus> ACTIVE =
            EnumSet.of(HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS);

    private final HousekeepingTaskRepository taskRepository;
    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;
    private final AppUserRepository appUserRepository;
    private final TenantAccessService tenantAccessService;
    private final RoomStatusAuditService roomStatusAuditService;

    public HousekeepingTaskService(
            HousekeepingTaskRepository taskRepository,
            RoomRepository roomRepository,
            ReservationRepository reservationRepository,
            AppUserRepository appUserRepository,
            TenantAccessService tenantAccessService,
            RoomStatusAuditService roomStatusAuditService) {
        this.taskRepository = taskRepository;
        this.roomRepository = roomRepository;
        this.reservationRepository = reservationRepository;
        this.appUserRepository = appUserRepository;
        this.tenantAccessService = tenantAccessService;
        this.roomStatusAuditService = roomStatusAuditService;
    }

    @Transactional
    public void onRoomBecameVacantDirty(UUID hotelId, UUID roomId, UUID bookingId) {
        createTaskInternal(hotelId, roomId, bookingId, HousekeepingTaskType.DEPARTURE_CLEAN, HousekeepingTaskPriority.URGENT, "Auto: room vacant dirty", true);
    }

    @Transactional
    public void onGuestCheckedIn(UUID hotelId, UUID roomId, UUID bookingId) {
        createTaskInternal(
                hotelId,
                roomId,
                bookingId,
                HousekeepingTaskType.STAYOVER_CLEAN,
                HousekeepingTaskPriority.NORMAL,
                "Scheduled for tomorrow morning",
                true);
    }

    @Transactional
    public HousekeepingTask createTask(
            UUID hotelId,
            String hotelHeader,
            UUID roomId,
            UUID bookingId,
            HousekeepingTaskType taskType,
            HousekeepingTaskPriority priority,
            String notes) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal u = tenantAccessService.currentUser();
        requireRole(u, Role.HOTEL_ADMIN, Role.MANAGER, Role.HOUSEKEEPING_SUPERVISOR, Role.SUPER_ADMIN);
        return createTaskInternal(hotelId, roomId, bookingId, taskType, priority, notes, false);
    }

    @Transactional
    public HousekeepingTask createTaskFromRequest(
            UUID hotelId, String hotelHeader, ApiDtos.HousekeepingTaskCreateRequest req) {
        HousekeepingTaskType type;
        HousekeepingTaskPriority priority;
        try {
            type = HousekeepingTaskType.valueOf(req.taskType().trim().toUpperCase(Locale.ROOT));
            priority = HousekeepingTaskPriority.valueOf(req.priority().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_HK_ENUM", "Invalid task_type or priority");
        }
        return createTask(hotelId, hotelHeader, req.roomId(), req.bookingId(), type, priority, req.notes());
    }

    public ApiDtos.HousekeepingBoardTask toBoardTaskDto(HousekeepingTask t) {
        return toBoardDto(t);
    }

    /**
     * @param skipIfDuplicate when true (auto hooks), do nothing if an active duplicate exists
     */
    private HousekeepingTask createTaskInternal(
            UUID hotelId,
            UUID roomId,
            UUID bookingId,
            HousekeepingTaskType taskType,
            HousekeepingTaskPriority priority,
            String notes,
            boolean skipIfDuplicate) {
        if (taskRepository.existsByHotel_IdAndRoom_IdAndTaskTypeAndStatusIn(hotelId, roomId, taskType, ACTIVE)) {
            if (skipIfDuplicate) {
                return null;
            }
            throw new ApiException(
                    HttpStatus.CONFLICT, "DUPLICATE_HK_TASK", "Active task of this type already exists for room");
        }
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        Reservation booking = null;
        if (bookingId != null) {
            booking = reservationRepository
                    .findByIdAndHotel_Id(bookingId, hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        }
        HousekeepingTask t = new HousekeepingTask();
        t.setHotel(room.getHotel());
        t.setRoom(room);
        t.setBooking(booking);
        t.setTaskType(taskType);
        t.setPriority(priority);
        t.setStatus(HousekeepingTaskStatus.PENDING);
        t.setNotes(notes);
        return taskRepository.save(t);
    }

    @Transactional
    public HousekeepingTask assignTask(UUID hotelId, String hotelHeader, UUID taskId, UUID staffUserId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal actor = tenantAccessService.currentUser();
        requireRole(actor, Role.HOUSEKEEPING_SUPERVISOR, Role.SUPER_ADMIN);
        HousekeepingTask t = loadTask(hotelId, taskId);
        AppUser staff = appUserRepository
                .findById(staffUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Staff user not found"));
        if (staff.getHotel() == null || !staff.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Staff user is not scoped to this hotel");
        }
        t.setAssignedTo(staff);
        t.setAssignedBy(appUserRepository.getReferenceById(actor.getId()));
        t.setAssignedAt(Instant.now());
        return taskRepository.save(t);
    }

    @Transactional
    public HousekeepingTask startTask(UUID hotelId, String hotelHeader, UUID taskId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        HousekeepingTask t = loadTask(hotelId, taskId);
        assertAssignedOrElevated(t);
        if (t.getStatus() != HousekeepingTaskStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "Task is not pending");
        }
        t.setStatus(HousekeepingTaskStatus.IN_PROGRESS);
        t.setStartedAt(Instant.now());
        return taskRepository.save(t);
    }

    @Transactional
    public HousekeepingTask completeTask(
            UUID hotelId, String hotelHeader, UUID taskId, String notes, String photoUrl, boolean checklistCompleted) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal me = tenantAccessService.currentUser();
        HousekeepingTask t = loadTask(hotelId, taskId);
        assertAssignedOrElevated(t);
        if (t.getStatus() != HousekeepingTaskStatus.IN_PROGRESS) {
            throw new ApiException(HttpStatus.CONFLICT, "Task must be in progress to complete");
        }
        t.setCompletedAt(Instant.now());
        t.setStatus(HousekeepingTaskStatus.COMPLETED);
        t.setNotes(notes);
        t.setPhotoUrl(photoUrl);
        t.setChecklistCompleted(checklistCompleted);
        t = taskRepository.save(t);

        if (t.getTaskType() == HousekeepingTaskType.DEPARTURE_CLEAN) {
            Room room = t.getRoom();
            RoomStatus prev = room.getStatus();
            CleanlinessStatus pc = room.getCleanliness();
            room.setStatus(RoomStatus.VACANT_CLEAN);
            room.setCleanliness(CleanlinessStatus.CLEAN);
            roomRepository.save(room);
            roomStatusAuditService.logTransition(
                    hotelId,
                    room,
                    prev,
                    RoomStatus.VACANT_CLEAN,
                    pc,
                    CleanlinessStatus.CLEAN,
                    me.getUsername(),
                    "Housekeeping DEPARTURE_CLEAN completed",
                    me.getId());
        }
        return t;
    }

    @Transactional
    public HousekeepingTask inspectTask(UUID hotelId, String hotelHeader, UUID taskId, int score) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal actor = tenantAccessService.currentUser();
        requireRole(actor, Role.HOUSEKEEPING_SUPERVISOR, Role.SUPER_ADMIN);
        if (score < 1 || score > 10) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "score must be 1..10");
        }
        HousekeepingTask t = loadTask(hotelId, taskId);
        if (t.getStatus() != HousekeepingTaskStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "Task must be completed before inspection");
        }
        t.setInspectedAt(Instant.now());
        t.setInspectedBy(appUserRepository.getReferenceById(actor.getId()));
        t.setInspectionScore(score);
        t.setStatus(HousekeepingTaskStatus.INSPECTED);
        t = taskRepository.save(t);

        Room room = t.getRoom();
        RoomStatus prev = room.getStatus();
        CleanlinessStatus pc = room.getCleanliness();
        room.setStatus(RoomStatus.INSPECTED);
        room.setCleanliness(CleanlinessStatus.INSPECTED);
        roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                prev,
                RoomStatus.INSPECTED,
                pc,
                CleanlinessStatus.INSPECTED,
                actor.getUsername(),
                "Housekeeping inspection score=" + score,
                actor.getId());
        return t;
    }

    @Transactional
    public HousekeepingTask skipDndTask(UUID hotelId, String hotelHeader, UUID taskId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        HousekeepingTask t = loadTask(hotelId, taskId);
        assertAssignedOrElevated(t);
        t.setStatus(HousekeepingTaskStatus.SKIPPED_DND);
        t.setDndSkippedAt(Instant.now());
        return taskRepository.save(t);
    }

    @Transactional(readOnly = true)
    public ApiDtos.HousekeepingBoardResponse getBoard(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<HousekeepingTask> all = taskRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId);
        List<ApiDtos.HousekeepingBoardTask> pending = new ArrayList<>();
        List<ApiDtos.HousekeepingBoardTask> inProg = new ArrayList<>();
        List<ApiDtos.HousekeepingBoardTask> done = new ArrayList<>();
        List<ApiDtos.HousekeepingBoardTask> inspected = new ArrayList<>();
        for (HousekeepingTask t : all) {
            ApiDtos.HousekeepingBoardTask dto = toBoardDto(t);
            switch (t.getStatus()) {
                case PENDING, SKIPPED_DND -> pending.add(dto);
                case IN_PROGRESS -> inProg.add(dto);
                case COMPLETED -> done.add(dto);
                case INSPECTED -> inspected.add(dto);
            }
        }
        return new ApiDtos.HousekeepingBoardResponse(pending, inProg, done, inspected);
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.HousekeepingBoardTask> getMyTasks(UUID hotelId, String hotelHeader, UUID userId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return taskRepository.findByHotel_IdAndAssignedTo_IdOrderByCreatedAtDesc(hotelId, userId).stream()
                .map(this::toBoardDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.HousekeepingStaffOption> listAssignableStaff(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return appUserRepository
                .findByHotel_IdAndRoleIn(
                        hotelId, List.of(Role.HOUSEKEEPING, Role.HOUSEKEEPING_SUPERVISOR))
                .stream()
                .map(u -> new ApiDtos.HousekeepingStaffOption(u.getId(), u.getUsername(), u.getRole().name()))
                .toList();
    }

    private ApiDtos.HousekeepingBoardTask toBoardDto(HousekeepingTask t) {
        String assignee = t.getAssignedTo() != null ? t.getAssignedTo().getUsername() : null;
        return new ApiDtos.HousekeepingBoardTask(
                t.getId(),
                t.getRoom().getRoomNumber(),
                t.getTaskType().name(),
                t.getStatus().name(),
                t.getPriority().name(),
                t.getAssignedTo() != null ? t.getAssignedTo().getId() : null,
                assignee,
                t.getCreatedAt(),
                t.getNotes());
    }

    private HousekeepingTask loadTask(UUID hotelId, UUID taskId) {
        HousekeepingTask t = taskRepository
                .findById(taskId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Task not found"));
        if (!t.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Task not found");
        }
        return t;
    }

    private void assertAssignedOrElevated(HousekeepingTask t) {
        UserPrincipal me = tenantAccessService.currentUser();
        if (isElevated(me)) {
            return;
        }
        if (t.getAssignedTo() != null && t.getAssignedTo().getId().equals(me.getId())) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN_TASK_ACTOR", "Not assigned to this task");
    }

    private static boolean isElevated(UserPrincipal me) {
        Role r = me.getRole();
        return r == Role.SUPER_ADMIN
                || r == Role.HOTEL_ADMIN
                || r == Role.MANAGER
                || r == Role.HOUSEKEEPING_SUPERVISOR;
    }

    private static void requireRole(UserPrincipal u, Role... anyOf) {
        for (Role r : anyOf) {
            if (u.getRole() == r) {
                return;
            }
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Insufficient role");
    }
}
