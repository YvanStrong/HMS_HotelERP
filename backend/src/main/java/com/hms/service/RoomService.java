package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.CleanlinessStatus;
import com.hms.domain.ReservationStatus;
import com.hms.domain.RoomStatus;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.entity.Hotel;
import com.hms.entity.RoomBlock;
import com.hms.entity.RoomType;
import com.hms.entity.RoomTypeNightlyRate;
import com.hms.events.RoomStatusChangedEvent;
import com.hms.repository.HotelRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomBlockRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomTypeNightlyRateRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final HotelRepository hotelRepository;
    private final ReservationRepository reservationRepository;
    private final RoomBlockRepository roomBlockRepository;
    private final TenantAccessService tenantAccessService;
    private final ApplicationEventPublisher eventPublisher;
    private final RoomStatusAuditService roomStatusAuditService;
    private final HousekeepingTaskService housekeepingTaskService;
    private final RoomTypeNightlyRateRepository roomTypeNightlyRateRepository;
    private final BookingDateNormalizer bookingDateNormalizer;

    public RoomService(
            RoomRepository roomRepository,
            RoomTypeRepository roomTypeRepository,
            HotelRepository hotelRepository,
            ReservationRepository reservationRepository,
            RoomBlockRepository roomBlockRepository,
            TenantAccessService tenantAccessService,
            ApplicationEventPublisher eventPublisher,
            RoomStatusAuditService roomStatusAuditService,
            HousekeepingTaskService housekeepingTaskService,
            RoomTypeNightlyRateRepository roomTypeNightlyRateRepository,
            BookingDateNormalizer bookingDateNormalizer) {
        this.roomRepository = roomRepository;
        this.roomTypeRepository = roomTypeRepository;
        this.hotelRepository = hotelRepository;
        this.reservationRepository = reservationRepository;
        this.roomBlockRepository = roomBlockRepository;
        this.tenantAccessService = tenantAccessService;
        this.eventPublisher = eventPublisher;
        this.roomStatusAuditService = roomStatusAuditService;
        this.housekeepingTaskService = housekeepingTaskService;
        this.roomTypeNightlyRateRepository = roomTypeNightlyRateRepository;
        this.bookingDateNormalizer = bookingDateNormalizer;
    }

    @Transactional(readOnly = true)
    public ApiDtos.PagedData<ApiDtos.RoomListItem> listRooms(
            UUID hotelId,
            String hotelHeader,
            int page,
            int size,
            String statusCsv,
            Integer floor,
            String roomTypeParam) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);

        Set<RoomStatus> roomStatuses = EnumSet.noneOf(RoomStatus.class);
        Set<CleanlinessStatus> clean = EnumSet.noneOf(CleanlinessStatus.class);
        parseStatusCsv(statusCsv, roomStatuses, clean);

        List<Specification<Room>> specs = new ArrayList<>();
        specs.add(RoomSpecifications.hotel(hotelId));
        if (!roomStatuses.isEmpty()) {
            specs.add(RoomSpecifications.statuses(roomStatuses));
        }
        if (!clean.isEmpty()) {
            specs.add(RoomSpecifications.cleanlinesses(clean));
        }
        specs.add(RoomSpecifications.floor(floor));
        UUID rtId = tryParseUuid(roomTypeParam);
        if (rtId != null) {
            specs.add(RoomSpecifications.roomTypeId(rtId));
        } else if (roomTypeParam != null && !roomTypeParam.isBlank()) {
            specs.add(RoomSpecifications.roomTypeCode(roomTypeParam));
        }
        Specification<Room> spec = RoomSpecifications.combine(specs);

        int p = Math.max(page, 1) - 1;
        int s = Math.min(Math.max(size, 1), 500);
        Page<Room> pg = roomRepository.findAll(spec, PageRequest.of(p, s));

        List<UUID> roomIds = pg.getContent().stream().map(Room::getId).toList();
        Map<UUID, Reservation> currentByRoom = loadCurrentReservations(roomIds);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate tomorrow = today.plusDays(1);
        Set<UUID> blockedTonight =
                new HashSet<>(roomBlockRepository.findRoomIdsBlockedOnNight(hotelId, today, tomorrow));

        List<ApiDtos.RoomListItem> data =
                pg.getContent().stream()
                        .map(r -> toListItem(r, currentByRoom.get(r.getId()), blockedTonight.contains(r.getId())))
                        .toList();

        return new ApiDtos.PagedData<>(data, paginate(page, s, pg.getTotalElements()));
    }

    @Transactional(readOnly = true)
    public ApiDtos.RoomStatusSummary roomStatusSummary(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        long total = roomRepository.countByHotel_Id(hotelId);
        Map<RoomStatus, Long> byStatus = new EnumMap<>(RoomStatus.class);
        for (Object[] row : roomRepository.countByStatusGrouped(hotelId)) {
            byStatus.put((RoomStatus) row[0], (Long) row[1]);
        }
        long occupied = byStatus.getOrDefault(RoomStatus.OCCUPIED, 0L);
        long vacantClean = byStatus.getOrDefault(RoomStatus.VACANT_CLEAN, 0L);
        long vacantDirty = byStatus.getOrDefault(RoomStatus.VACANT_DIRTY, 0L);
        long outOfOrder = byStatus.getOrDefault(RoomStatus.OUT_OF_ORDER, 0L);
        return new ApiDtos.RoomStatusSummary(total, occupied, vacantClean, vacantDirty, outOfOrder);
    }

    private static ApiDtos.Pagination paginate(int page, int size, long total) {
        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 0;
        boolean hasNext = (long) page * size < total;
        boolean hasPrevious = page > 1;
        return new ApiDtos.Pagination(page, size, total, totalPages, hasNext, hasPrevious);
    }

    private Map<UUID, Reservation> loadCurrentReservations(List<UUID> roomIds) {
        if (roomIds.isEmpty()) {
            return Map.of();
        }
        List<Reservation> list = reservationRepository.findByRoom_IdInAndStatusIn(
                roomIds, List.of(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN));
        Map<UUID, Reservation> map = new HashMap<>();
        for (Reservation r : list) {
            if (r.getRoom() == null) {
                continue;
            }
            UUID rid = r.getRoom().getId();
            Reservation existing = map.get(rid);
            if (existing == null) {
                map.put(rid, r);
            } else if (r.getStatus() == ReservationStatus.CHECKED_IN) {
                map.put(rid, r);
            }
        }
        return map;
    }

    private ApiDtos.RoomListItem toListItem(Room r, Reservation res, boolean hasActiveBlock) {
        RoomType rt = r.getRoomType();
        ApiDtos.RoomTypeSummary rts = roomTypeSummary(rt);
        ApiDtos.ReservationSummary rs = null;
        if (res != null) {
            rs = reservationSummary(res);
        }
        return new ApiDtos.RoomListItem(
                r.getId(),
                r.getRoomNumber(),
                r.getFloor(),
                r.getBuilding(),
                r.getPhotoUrl(),
                rts,
                r.getStatus().name(),
                r.getCleanliness().name(),
                r.isOutOfOrder(),
                r.isDnd(),
                r.getDndUntil(),
                RoomOperationalState.derive(r, res),
                r.getUpdatedAt(),
                rs,
                hasActiveBlock);
    }

    private static ApiDtos.RoomTypeSummary roomTypeSummary(RoomType rt) {
        return new ApiDtos.RoomTypeSummary(
                rt.getId(), rt.getName(), rt.getBaseRate(), rt.getMaxOccupancy(), rt.getBedCount());
    }

    private static ApiDtos.ReservationSummary reservationSummary(Reservation res) {
        String gn = res.getGuest().getFirstName() + " " + res.getGuest().getLastName();
        return new ApiDtos.ReservationSummary(
                res.getId(),
                res.getConfirmationCode(),
                gn,
                res.getGuest().getId(),
                res.getStatus().name(),
                res.getCheckInDate(),
                res.getCheckOutDate());
    }

    private void parseStatusCsv(String csv, Set<RoomStatus> roomStatuses, Set<CleanlinessStatus> clean) {
        if (csv == null || csv.isBlank()) {
            return;
        }
        for (String part : csv.split(",")) {
            String t = part.trim().toUpperCase();
            if (t.isEmpty()) {
                continue;
            }
            RoomStatus rs = parseRoomStatusToken(t);
            if (rs != null) {
                roomStatuses.add(rs);
                continue;
            }
            try {
                clean.add(CleanlinessStatus.valueOf(t));
            } catch (IllegalArgumentException ignored) {
                // ignore unknown token
            }
        }
    }

    /** Accepts new enum names plus legacy API tokens (AVAILABLE / CHECKED_IN / CHECKED_OUT). */
    private static RoomStatus parseRoomStatusToken(String t) {
        return switch (t) {
            case "AVAILABLE" -> RoomStatus.VACANT_CLEAN;
            case "CHECKED_IN" -> RoomStatus.OCCUPIED;
            case "CHECKED_OUT" -> RoomStatus.VACANT_DIRTY;
            default -> {
                try {
                    yield RoomStatus.valueOf(t);
                } catch (IllegalArgumentException e) {
                    yield null;
                }
            }
        };
    }

    private UUID tryParseUuid(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(s.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public ApiDtos.RoomDetailResponse getRoom(UUID hotelId, String hotelHeader, UUID roomId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        Reservation current = loadCurrentReservationForRoom(roomId);
        return toDetail(room, current);
    }

    @Transactional
    public ApiDtos.DeleteRoomResponse softDeleteRoom(UUID hotelId, String hotelHeader, UUID roomId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        List<Reservation> active =
                reservationRepository.findByRoom_IdAndStatusInOrderByCheckInDateDesc(
                        roomId, List.of(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN));
        if (!active.isEmpty()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Cannot delete room with active reservations (CONFIRMED or CHECKED_IN). Cancel or check out first.");
        }
        int n = roomRepository.softDeleteByIdAndHotel_Id(roomId, hotelId, Instant.now());
        if (n == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Room not found or already deleted");
        }
        return new ApiDtos.DeleteRoomResponse(room.getId(), "Room soft-deleted");
    }

    private Reservation loadCurrentReservationForRoom(UUID roomId) {
        List<Reservation> list =
                reservationRepository.findByRoom_IdInAndStatusIn(
                        List.of(roomId), List.of(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN));
        if (list.isEmpty()) {
            return null;
        }
        Reservation picked = list.get(0);
        for (Reservation r : list) {
            if (r.getStatus() == ReservationStatus.CHECKED_IN) {
                picked = r;
                break;
            }
        }
        return picked;
    }

    private ApiDtos.RoomDetailResponse toDetail(Room r, Reservation res) {
        RoomType rt = r.getRoomType();
        ApiDtos.RoomTypeSummary rts = roomTypeSummary(rt);
        ApiDtos.ReservationSummary rs = null;
        if (res != null) {
            rs = reservationSummary(res);
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate tomorrow = today.plusDays(1);
        List<RoomBlock> activeBlocks =
                roomBlockRepository.findActiveOnNight(r.getId(), today, tomorrow);
        UUID activeBlockId = activeBlocks.isEmpty() ? null : activeBlocks.get(0).getId();
        return new ApiDtos.RoomDetailResponse(
                r.getId(),
                r.getRoomNumber(),
                r.getFloor(),
                r.getBuilding(),
                r.getPhotoUrl(),
                rts,
                r.getStatus().name(),
                r.getCleanliness().name(),
                r.isOutOfOrder(),
                r.isDnd(),
                r.getDndUntil(),
                r.getDndSetAt(),
                RoomOperationalState.derive(r, res),
                r.getMaintenanceNotes(),
                splitAmenities(r.getAmenitiesOverride()),
                r.getUpdatedAt(),
                rs,
                activeBlockId);
    }

    private static List<String> splitAmenities(String s) {
        if (s == null || s.isBlank()) {
            return List.of();
        }
        return Arrays.stream(s.split(","))
                .map(String::trim)
                .filter(t -> !t.isEmpty())
                .toList();
    }

    @Transactional
    public ApiDtos.CreateRoomResponse createRoom(
            UUID hotelId, String hotelHeader, ApiDtos.CreateRoomRequest req, String createdBy) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        if (roomRepository.existsByHotel_IdAndRoomNumberIgnoreCase(hotelId, req.roomNumber())) {
            throw new ApiException(HttpStatus.CONFLICT, "Room number already exists");
        }
        RoomType rt = resolveRoomType(hotelId, req.roomTypeId(), req.roomTypeCode());

        Room room = new Room();
        room.setHotel(hotelRepository.getReferenceById(hotelId));
        room.setRoomType(rt);
        room.setRoomNumber(req.roomNumber().trim());
        room.setFloor(req.floor());
        room.setBuilding(req.building());
        if (req.imageUrl() != null) {
            room.setPhotoUrl(req.imageUrl().trim().isEmpty() ? null : req.imageUrl().trim());
        }
        RoomStatus initial = RoomStatus.VACANT_CLEAN;
        if (req.initialStatus() != null && !req.initialStatus().isBlank()) {
            initial = RoomStatus.valueOf(req.initialStatus().trim().toUpperCase());
        }
        room.setStatus(initial);
        room.setCleanliness(CleanlinessStatus.INSPECTED);
        room.setOutOfOrder(initial == RoomStatus.OUT_OF_ORDER);
        if (req.amenitiesOverride() != null && !req.amenitiesOverride().isEmpty()) {
            room.setAmenitiesOverride(String.join(",", req.amenitiesOverride()));
        }
        room = roomRepository.save(room);
        return new ApiDtos.CreateRoomResponse(
                room.getId(),
                room.getRoomNumber(),
                room.getFloor(),
                room.getBuilding(),
                room.getPhotoUrl(),
                roomTypeSummary(room.getRoomType()),
                room.getStatus().name(),
                room.getCleanliness().name(),
                room.isOutOfOrder(),
                splitAmenities(room.getAmenitiesOverride()),
                room.getCreatedAt(),
                createdBy,
                "Room created successfully");
    }

    @Transactional
    public ApiDtos.PatchRoomResponse patchRoom(
            UUID hotelId, String hotelHeader, UUID roomId, ApiDtos.PatchRoomRequest req, String updatedBy) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        ApiDtos.RoomLifecycleSnapshot previousValues = roomLifecycleSnapshot(room);
        RoomStatus prev = room.getStatus();
        CleanlinessStatus prevClean = room.getCleanliness();
        if (req.status() != null && !req.status().isBlank()) {
            RoomStatus target = parseRoomStatusToken(req.status().trim().toUpperCase());
            if (target == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid room status: " + req.status());
            }
            RoomStatusTransitions.validate(prev, target);
            room.setStatus(target);
            syncCleanlinessFromOperationalStatus(room, target);
        }
        if (req.cleanliness() != null && !req.cleanliness().isBlank()) {
            room.setCleanliness(CleanlinessStatus.valueOf(req.cleanliness().trim().toUpperCase()));
        }
        if (req.maintenanceNotes() != null) {
            room.setMaintenanceNotes(req.maintenanceNotes());
        }
        if (req.isOutOfOrder() != null) {
            room.setOutOfOrder(req.isOutOfOrder());
        }
        if (req.building() != null) {
            room.setBuilding(req.building());
        }
        if (req.floor() != null) {
            room.setFloor(req.floor());
        }
        if (req.imageUrl() != null) {
            room.setPhotoUrl(req.imageUrl().trim().isEmpty() ? null : req.imageUrl().trim());
        }
        if (room.getStatus() == RoomStatus.OUT_OF_ORDER) {
            room.setOutOfOrder(true);
        } else if (room.getStatus() == RoomStatus.VACANT_CLEAN && prev == RoomStatus.OUT_OF_ORDER) {
            room.setOutOfOrder(false);
        }
        room = roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                prev,
                room.getStatus(),
                prevClean,
                room.getCleanliness(),
                updatedBy,
                "PATCH /rooms/{roomId}",
                tenantAccessService.currentUser().getId());
        if (room.getStatus() == RoomStatus.VACANT_DIRTY && prev != RoomStatus.VACANT_DIRTY) {
            UUID bookingId =
                    room.getCurrentBooking() != null ? room.getCurrentBooking().getId() : null;
            housekeepingTaskService.onRoomBecameVacantDirty(hotelId, room.getId(), bookingId);
        }
        ApiDtos.RoomLifecycleSnapshot updatedValues = roomLifecycleSnapshot(room);
        Map<String, Object> payload = new HashMap<>();
        payload.put("roomId", room.getId());
        payload.put("roomNumber", room.getRoomNumber());
        payload.put("status", room.getStatus().name());
        payload.put("cleanliness", room.getCleanliness().name());
        return new ApiDtos.PatchRoomResponse(
                room.getId(),
                room.getRoomNumber(),
                previousValues,
                updatedValues,
                room.getUpdatedAt(),
                updatedBy,
                new ApiDtos.RoomUpdateBroadcast("ROOM_UPDATED", "hotel:" + hotelId + ":rooms", payload));
    }

    private static ApiDtos.RoomLifecycleSnapshot roomLifecycleSnapshot(Room room) {
        return new ApiDtos.RoomLifecycleSnapshot(
                room.getStatus().name(),
                room.getCleanliness().name(),
                room.isOutOfOrder(),
                room.getMaintenanceNotes(),
                room.getFloor(),
                room.getBuilding());
    }

    @Transactional
    public ApiDtos.HousekeepingPatchResponse patchHousekeepingStatus(
            UUID hotelId, String hotelHeader, UUID roomId, ApiDtos.HousekeepingPatchRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal user = tenantAccessService.currentUser();
        Room room = roomRepository
                .findByIdAndHotel_Id(roomId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found"));
        RoomStatus previous = room.getStatus();
        CleanlinessStatus previousClean = room.getCleanliness();
        boolean statusChange = req.status() != null && !req.status().isBlank();
        if (statusChange) {
            RoomStatus target = parseRoomStatusToken(req.status().trim().toUpperCase());
            if (target == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid room status: " + req.status());
            }
            String reasonText =
                    (req.reason() != null && !req.reason().isBlank())
                            ? req.reason().trim()
                            : (req.notes() != null && !req.notes().isBlank() ? req.notes().trim() : null);
            if (reasonText == null || reasonText.isBlank()) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST, "reason is required when changing operational room status");
            }
            RoomStatusTransitions.validate(previous, target);
            room.setStatus(target);
            syncCleanlinessFromOperationalStatus(room, target);
        }
        if (req.cleanliness() != null && !req.cleanliness().isBlank()) {
            room.setCleanliness(CleanlinessStatus.valueOf(req.cleanliness().trim().toUpperCase()));
        }
        if (req.notes() != null) {
            room.setMaintenanceNotes(req.notes());
        }
        room = roomRepository.save(room);
        String auditReason =
                statusChange
                        ? (req.reason() != null && !req.reason().isBlank()
                                ? req.reason().trim()
                                : (req.notes() != null ? req.notes().trim() : "Status change"))
                        : (req.notes() != null ? req.notes() : "Housekeeping patch");
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                previous,
                room.getStatus(),
                previousClean,
                room.getCleanliness(),
                user.getUsername(),
                auditReason,
                user.getId());
        if (room.getStatus() == RoomStatus.VACANT_DIRTY && previous != RoomStatus.VACANT_DIRTY) {
            UUID bookingId =
                    room.getCurrentBooking() != null ? room.getCurrentBooking().getId() : null;
            housekeepingTaskService.onRoomBecameVacantDirty(hotelId, room.getId(), bookingId);
        }
        String msg = "Room " + room.getRoomNumber() + " updated to " + room.getStatus();
        eventPublisher.publishEvent(new RoomStatusChangedEvent(
                hotelId, roomId, previous, room.getStatus(), msg));
        return new ApiDtos.HousekeepingPatchResponse(
                room.getId(),
                previous.name(),
                room.getStatus().name(),
                room.getUpdatedAt(),
                msg);
    }

    private static void syncCleanlinessFromOperationalStatus(Room room, RoomStatus s) {
        switch (s) {
            case VACANT_CLEAN -> room.setCleanliness(CleanlinessStatus.CLEAN);
            case VACANT_DIRTY -> room.setCleanliness(CleanlinessStatus.DIRTY);
            case INSPECTED -> room.setCleanliness(CleanlinessStatus.INSPECTED);
            default -> {
                /* keep existing cleanliness for OCCUPIED, RESERVED, BLOCKED, etc. */
            }
        }
    }

    private void ensureHotel(UUID hotelId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
    }

    private RoomType resolveRoomType(UUID hotelId, UUID roomTypeId, String roomTypeCode) {
        boolean hasId = roomTypeId != null;
        boolean hasCode = roomTypeCode != null && !roomTypeCode.isBlank();
        if (!hasId && !hasCode) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Provide roomTypeId (UUID from GET/POST .../room-types) or roomTypeCode (e.g. STD, DLX). Request hotelId="
                            + hotelId);
        }
        if (hasId) {
            return roomTypeRepository
                    .findByIdAndHotel_Id(roomTypeId, hotelId)
                    .orElseThrow(() -> new ApiException(
                            HttpStatus.NOT_FOUND,
                            "Room type not found for hotelId="
                                    + hotelId
                                    + " roomTypeId="
                                    + roomTypeId
                                    + ". GET /api/v1/hotels/"
                                    + hotelId
                                    + "/room-types — ids from another hotel will not work."));
        }
        return roomTypeRepository
                .findByHotel_IdAndCodeIgnoreCase(hotelId, roomTypeCode.trim())
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "No room type code "
                                + roomTypeCode.trim()
                                + " for hotelId="
                                + hotelId
                                + ". Create the type or GET /api/v1/hotels/"
                                + hotelId
                                + "/room-types."));
    }

    @Transactional(readOnly = true)
    public ApiDtos.RoomTypesAvailabilityResponse roomTypesAvailability(
            UUID hotelId,
            String hotelHeader,
            LocalDate checkIn,
            LocalDate checkOut,
            UUID roomTypeId,
            int adults) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        ensureHotel(hotelId);
        LocalDate exclusiveCheckOut = bookingDateNormalizer.toStorageCheckOutExclusive(checkIn, checkOut);
        if (!checkIn.isBefore(exclusiveCheckOut)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "check_in must be before check_out");
        }
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        String currency = hotel.getCurrency();
        int nights = (int) ChronoUnit.DAYS.between(checkIn, exclusiveCheckOut);
        List<RoomType> types =
                roomTypeId != null
                        ? roomTypeRepository
                                .findByIdAndHotel_Id(roomTypeId, hotelId)
                                .map(List::of)
                                .orElse(List.of())
                        : roomTypeRepository.findByHotel_Id(hotelId);
        List<ApiDtos.RoomTypeAvailabilityItem> out = new ArrayList<>();
        for (RoomType rt : types) {
            int available = countSellableRoomsForStay(hotelId, rt.getId(), checkIn, exclusiveCheckOut, adults);
            if (available == 0) {
                continue;
            }
            BigDecimal base = rt.getBaseRate();
            BigDecimal sumNights = BigDecimal.ZERO;
            for (LocalDate d = checkIn; d.isBefore(exclusiveCheckOut); d = d.plusDays(1)) {
                BigDecimal night = roomTypeNightlyRateRepository
                        .findByRoomType_IdAndRateDate(rt.getId(), d)
                        .map(RoomTypeNightlyRate::getNightlyRate)
                        .orElse(base);
                sumNights = sumNights.add(night);
            }
            BigDecimal total = sumNights.setScale(2, RoundingMode.HALF_UP);
            List<String> amenities = rt.getAmenities() != null ? List.copyOf(rt.getAmenities()) : List.of();
            out.add(new ApiDtos.RoomTypeAvailabilityItem(
                    rt.getId(), rt.getName(), base, total, currency, nights, available, amenities, List.of()));
        }
        return new ApiDtos.RoomTypesAvailabilityResponse(out);
    }

    private int countSellableRoomsForStay(
            UUID hotelId, UUID roomTypeId, LocalDate checkIn, LocalDate checkOut, int adults) {
        List<Room> rooms = roomRepository.findByHotel_IdAndRoomType_Id(hotelId, roomTypeId);
        int n = 0;
        for (Room r : rooms) {
            if (r.getRoomType().getMaxOccupancy() < adults) {
                continue;
            }
            if (r.isOutOfOrder() || r.getStatus() == RoomStatus.OUT_OF_ORDER) {
                continue;
            }
            if (!RoomBookingEligibility.isVacantBookable(r)) {
                continue;
            }
            if (reservationRepository.countOverlapping(r.getId(), checkIn, checkOut, null) > 0) {
                continue;
            }
            if (roomBlockRepository.countActiveOverlapping(r.getId(), checkIn, checkOut) > 0) {
                continue;
            }
            n++;
        }
        return n;
    }
}
