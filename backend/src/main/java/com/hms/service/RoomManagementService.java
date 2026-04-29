package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.ReservationStatus;
import com.hms.domain.RoomBlockType;
import com.hms.domain.RoomStatus;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.entity.RoomBlock;
import com.hms.entity.RoomTypeNightlyRate;
import com.hms.entity.RoomType;
import com.hms.repository.HotelRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomBlockRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomStatusLogRepository;
import com.hms.repository.RoomTypeNightlyRateRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomManagementService {

    private final RoomRepository roomRepository;
    private final RoomBlockRepository roomBlockRepository;
    private final RoomStatusLogRepository roomStatusLogRepository;
    private final ReservationRepository reservationRepository;
    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomTypeNightlyRateRepository nightlyRateRepository;
    private final TenantAccessService tenantAccessService;
    private final RoomStatusAuditService roomStatusAuditService;

    public RoomManagementService(
            RoomRepository roomRepository,
            RoomBlockRepository roomBlockRepository,
            RoomStatusLogRepository roomStatusLogRepository,
            ReservationRepository reservationRepository,
            HotelRepository hotelRepository,
            RoomTypeRepository roomTypeRepository,
            RoomTypeNightlyRateRepository nightlyRateRepository,
            TenantAccessService tenantAccessService,
            RoomStatusAuditService roomStatusAuditService) {
        this.roomRepository = roomRepository;
        this.roomBlockRepository = roomBlockRepository;
        this.roomStatusLogRepository = roomStatusLogRepository;
        this.reservationRepository = reservationRepository;
        this.hotelRepository = hotelRepository;
        this.roomTypeRepository = roomTypeRepository;
        this.nightlyRateRepository = nightlyRateRepository;
        this.tenantAccessService = tenantAccessService;
        this.roomStatusAuditService = roomStatusAuditService;
    }

    @Transactional(readOnly = true)
    public ApiDtos.RoomDashboardResponse dashboard(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        List<Room> rooms = roomRepository.findByHotel_Id(hotelId);
        Map<String, Long> counts = new HashMap<>();
        for (Room r : rooms) {
            Reservation res = currentReservationForRoom(r.getId());
            String bucket = RoomOperationalState.derive(r, res);
            counts.merge(bucket, 1L, Long::sum);
        }
        Instant cutoff = Instant.now().minusSeconds(24L * 3600L);
        List<ApiDtos.DndStaleRoom> stale =
                roomRepository.findDndStale(hotelId, cutoff).stream()
                        .map(r -> new ApiDtos.DndStaleRoom(r.getId(), r.getRoomNumber(), r.getDndSetAt()))
                        .toList();
        return new ApiDtos.RoomDashboardResponse(hotelId, counts, rooms.size(), Instant.now(), stale);
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.RoomStatusLogEntry> statusHistory(UUID hotelId, String hotelHeader, UUID roomId, int limit) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        int lim = Math.min(Math.max(limit, 1), 200);
        return roomStatusLogRepository
                .findByRoomIdOrderByCreatedAtDesc(roomId, PageRequest.of(0, lim))
                .stream()
                .map(l -> new ApiDtos.RoomStatusLogEntry(
                        l.getId(),
                        l.getPreviousStatus(),
                        l.getNewStatus(),
                        l.getPreviousCleanliness(),
                        l.getNewCleanliness(),
                        l.getActor(),
                        l.getChangedByUserId(),
                        l.getReason(),
                        l.getCreatedAt()))
                .toList();
    }

    @Transactional
    public ApiDtos.RoomDndResponse patchDnd(
            UUID hotelId,
            String hotelHeader,
            UUID roomId,
            ApiDtos.RoomDndPatchRequest req,
            String actor,
            UUID actorUserId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        boolean prevDnd = room.isDnd();
        Instant prevUntil = room.getDndUntil();
        Boolean dndFlag = req.isDnd() != null ? req.isDnd() : req.enabled();
        String untilRaw =
                (req.expiresAt() != null && !req.expiresAt().isBlank())
                        ? req.expiresAt().trim()
                        : (req.dndUntil() != null && !req.dndUntil().isBlank() ? req.dndUntil().trim() : null);
        if (dndFlag != null) {
            room.setDnd(Boolean.TRUE.equals(dndFlag));
        }
        if (Boolean.FALSE.equals(dndFlag)) {
            room.setDndUntil(null);
            room.setDndSetAt(null);
        } else if (untilRaw != null && !untilRaw.isBlank()) {
            room.setDndUntil(Instant.parse(untilRaw));
            room.setDnd(true);
        }
        boolean nowDnd = room.isDnd();
        if (!nowDnd) {
            room.setDndSetAt(null);
        } else if (!prevDnd) {
            room.setDndSetAt(Instant.now());
        }
        room = roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                room.getStatus(),
                room.getStatus(),
                room.getCleanliness(),
                room.getCleanliness(),
                actor,
                "DND "
                        + (room.isDnd() ? "ON" : "OFF")
                        + (room.getDndUntil() != null ? " until " + room.getDndUntil() : ""),
                actorUserId);
        return new ApiDtos.RoomDndResponse(
                room.getId(),
                room.isDnd(),
                room.getDndUntil(),
                prevDnd,
                prevUntil,
                room.getUpdatedAt());
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.RoomBlockResponse> listBlocks(
            UUID hotelId, String hotelHeader, LocalDate rangeStart, LocalDate rangeEnd) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (rangeEnd.isBefore(rangeStart)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "rangeEnd must be on or after rangeStart");
        }
        return roomBlockRepository.findActiveInRange(hotelId, rangeStart, rangeEnd).stream()
                .map(this::toBlockDto)
                .toList();
    }

    @Transactional
    public ApiDtos.RoomBlockResponse createBlock(
            UUID hotelId, String hotelHeader, ApiDtos.RoomBlockCreateRequest req, String actor) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (!req.endDate().isAfter(req.startDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "endDate must be after startDate (exclusive end night)");
        }
        Room room = roomRepository
                .findByIdAndHotel_Id(req.roomId(), hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        RoomBlockType type = RoomBlockType.valueOf(req.blockType().trim().toUpperCase());
        if (roomBlockRepository.countActiveOverlapping(room.getId(), req.startDate(), req.endDate()) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Room already has an active block overlapping these dates");
        }
        long resOverlap =
                reservationRepository.countOverlapping(room.getId(), req.startDate(), req.endDate(), null);
        if (resOverlap > 0) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Cannot block: active reservation overlaps this period. Cancel or adjust reservation first.");
        }
        RoomBlock b = new RoomBlock();
        b.setHotel(room.getHotel());
        b.setRoom(room);
        b.setBlockType(type);
        b.setStartDate(req.startDate());
        b.setEndDate(req.endDate());
        b.setNotes(req.notes());
        b.setCreatedBy(actor);
        b.setAutoRelease(false);
        b.setBlockedUntilInstant(null);
        b = roomBlockRepository.save(b);
        RoomStatus previousRoomStatus = room.getStatus();
        room.setStatus(RoomStatus.BLOCKED);
        roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                previousRoomStatus,
                RoomStatus.BLOCKED,
                room.getCleanliness(),
                room.getCleanliness(),
                actor,
                "Room block created: " + type);
        return toBlockDto(b);
    }

    @Transactional
    public ApiDtos.RoomBlockResponse releaseBlock(UUID hotelId, String hotelHeader, UUID blockId, String actor) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        RoomBlock b = roomBlockRepository
                .findById(blockId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Block not found"));
        if (!b.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Block not found");
        }
        if (b.getReleasedAt() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "Block already released");
        }
        b.setReleasedAt(Instant.now());
        roomBlockRepository.save(b);
        finalizeRoomBlockAfterRelease(hotelId, b.getRoom(), actor);
        return toBlockDto(b);
    }

    @Transactional
    public ApiDtos.RoomBlockResponse createOperationalRoomBlock(
            UUID hotelId,
            String hotelHeader,
            UUID roomId,
            ApiDtos.RoomOperationalBlockRequest req,
            String actor) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        LocalDate startDate = req.blockedFrom().atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate endExclusive = req.blockedUntil().atZone(ZoneOffset.UTC).toLocalDate().plusDays(1);
        if (!endExclusive.isAfter(startDate)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "blocked_until must be after blocked_from");
        }
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        RoomBlockType type = parseOperationalBlockType(req.blockType());
        if (roomBlockRepository.countActiveOverlapping(room.getId(), startDate, endExclusive) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Room already has an active block overlapping these dates");
        }
        long resOverlap =
                reservationRepository.countOverlapping(room.getId(), startDate, endExclusive, null);
        if (resOverlap > 0) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Cannot block: active reservation overlaps this period. Cancel or adjust reservation first.");
        }
        RoomBlock b = new RoomBlock();
        b.setHotel(room.getHotel());
        b.setRoom(room);
        b.setBlockType(type);
        b.setStartDate(startDate);
        b.setEndDate(endExclusive);
        b.setNotes(req.reason());
        b.setCreatedBy(actor);
        b.setAutoRelease(req.autoReleaseFlag());
        b.setBlockedUntilInstant(req.blockedUntil());
        b = roomBlockRepository.save(b);
        RoomStatus previousRoomStatus = room.getStatus();
        room.setStatus(RoomStatus.BLOCKED);
        roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                previousRoomStatus,
                RoomStatus.BLOCKED,
                room.getCleanliness(),
                room.getCleanliness(),
                actor,
                "Room block created: " + type + " — " + req.reason());
        return toBlockDto(b);
    }

    @Transactional
    public ApiDtos.RoomBlockResponse releaseOperationalRoomBlock(
            UUID hotelId, String hotelHeader, UUID roomId, String actor) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<RoomBlock> active =
                roomBlockRepository.findByRoom_IdAndReleasedAtIsNullOrderByCreatedAtDesc(roomId);
        if (active.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No active block for this room");
        }
        RoomBlock b = active.get(0);
        if (!b.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Block not found");
        }
        b.setReleasedAt(Instant.now());
        roomBlockRepository.save(b);
        finalizeRoomBlockAfterRelease(hotelId, b.getRoom(), actor);
        return toBlockDto(b);
    }

    /** Called by scheduler — no tenant header; operates on persisted rows only. */
    @Transactional
    public int releaseExpiredAutoBlocks() {
        Instant now = Instant.now();
        List<UUID> ids = roomBlockRepository.findIdsDueAutoRelease(now);
        int n = 0;
        for (UUID id : ids) {
            RoomBlock b = roomBlockRepository.findById(id).orElse(null);
            if (b == null || b.getReleasedAt() != null) {
                continue;
            }
            UUID hid = b.getHotel().getId();
            b.setReleasedAt(now);
            roomBlockRepository.save(b);
            finalizeRoomBlockAfterRelease(hid, b.getRoom(), "system-auto-release");
            n++;
        }
        return n;
    }

    private void finalizeRoomBlockAfterRelease(UUID hotelId, Room room, String actor) {
        long stillActive = roomBlockRepository.countByRoom_IdAndReleasedAtIsNull(room.getId());
        if (room.getStatus() == RoomStatus.BLOCKED && stillActive == 0) {
            RoomStatus prev = room.getStatus();
            room.setStatus(RoomStatus.VACANT_CLEAN);
            roomRepository.save(room);
            roomStatusAuditService.logTransition(
                    hotelId,
                    room,
                    prev,
                    RoomStatus.VACANT_CLEAN,
                    room.getCleanliness(),
                    room.getCleanliness(),
                    actor,
                    "Last active room block released");
        }
    }

    private static RoomBlockType parseOperationalBlockType(String raw) {
        String t = raw.trim().toUpperCase();
        return switch (t) {
            case "VIP_HOLD" -> RoomBlockType.VIP_PRE_ASSIGN;
            case "COURTESY" -> RoomBlockType.COURTESY_HOLD;
            default -> {
                try {
                    yield RoomBlockType.valueOf(t);
                } catch (IllegalArgumentException e) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown block_type: " + raw);
                }
            }
        };
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.RoomTypeNightlyRateEntry> listNightlyRates(
            UUID hotelId, String hotelHeader, UUID roomTypeId, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        RoomType rt = roomTypeRepository
                .findByIdAndHotel_Id(roomTypeId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room type not found"));
        return nightlyRateRepository
                .findByRoomType_IdAndRateDateBetweenOrderByRateDateAsc(rt.getId(), from, to)
                .stream()
                .map(r -> new ApiDtos.RoomTypeNightlyRateEntry(r.getRateDate(), r.getNightlyRate()))
                .toList();
    }

    @Transactional
    public ApiDtos.RoomTypeNightlyRatesUpsertResponse upsertNightlyRates(
            UUID hotelId, String hotelHeader, UUID roomTypeId, ApiDtos.RoomTypeNightlyRatesUpsertRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        RoomType rt = roomTypeRepository
                .findByIdAndHotel_Id(roomTypeId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room type not found"));
        int n = 0;
        for (ApiDtos.RoomTypeNightlyRateEntry e : body.rates()) {
            if (e.nightlyRate() == null || e.nightlyRate().signum() < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid nightly rate for " + e.rateDate());
            }
            var existing = nightlyRateRepository.findByRoomType_IdAndRateDate(rt.getId(), e.rateDate());
            if (existing.isPresent()) {
                RoomTypeNightlyRate row = existing.get();
                row.setNightlyRate(e.nightlyRate());
                nightlyRateRepository.save(row);
            } else {
                RoomTypeNightlyRate row = new RoomTypeNightlyRate();
                row.setRoomType(rt);
                row.setRateDate(e.rateDate());
                row.setNightlyRate(e.nightlyRate());
                nightlyRateRepository.save(row);
            }
            n++;
        }
        return new ApiDtos.RoomTypeNightlyRatesUpsertResponse(roomTypeId, n, "Nightly rates upserted for room type");
    }

    @Transactional(readOnly = true)
    public ApiDtos.RoomOccupancyGridResponse occupancyGrid(UUID hotelId, String hotelHeader, LocalDate from, LocalDate to) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (to.isBefore(from)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "to must be on or after from");
        }
        long totalRooms = roomRepository.countByHotel_Id(hotelId);
        List<ApiDtos.RoomDailyOccupancyRow> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            long occ = reservationRepository.countDistinctOccupiedRoomsForNight(hotelId, d);
            days.add(new ApiDtos.RoomDailyOccupancyRow(d, occ, totalRooms));
        }
        return new ApiDtos.RoomOccupancyGridResponse(hotelId, days);
    }

    private ApiDtos.RoomBlockResponse toBlockDto(RoomBlock b) {
        return new ApiDtos.RoomBlockResponse(
                b.getId(),
                b.getRoom().getId(),
                b.getRoom().getRoomNumber(),
                b.getBlockType().name(),
                b.getStartDate(),
                b.getEndDate(),
                b.getNotes(),
                b.getCreatedBy(),
                b.getCreatedAt(),
                b.getReleasedAt());
    }

    private Reservation currentReservationForRoom(UUID roomId) {
        List<Reservation> list =
                reservationRepository.findByRoom_IdInAndStatusIn(
                        List.of(roomId), List.of(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN));
        if (list.isEmpty()) {
            return null;
        }
        Reservation picked = list.get(0);
        for (Reservation r : list) {
            if (r.getStatus() == ReservationStatus.CHECKED_IN) {
                return r;
            }
        }
        return picked;
    }

    private void ensureHotel(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
    }
}
