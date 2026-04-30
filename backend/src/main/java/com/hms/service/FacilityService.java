package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.FacilityDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.FacilityBookingStatus;
import com.hms.domain.FacilityPaymentStatus;
import com.hms.domain.FacilitySlotStatus;
import com.hms.domain.FacilityMaintenanceStatus;
import com.hms.domain.FacilityPriority;
import com.hms.domain.FacilityType;
import com.hms.domain.ReservationStatus;
import com.hms.entity.Facility;
import com.hms.entity.FacilityBooking;
import com.hms.entity.FacilityMaintenance;
import com.hms.entity.FacilitySlot;
import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.FacilityBookingRepository;
import com.hms.repository.FacilityMaintenanceRepository;
import com.hms.repository.FacilityRepository;
import com.hms.repository.FacilitySlotRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.ReservationRepository;
import com.hms.security.TenantAccessService;
import com.hms.util.QrCodeUtil;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FacilityService {

    private static final List<FacilityBookingStatus> OCCUPYING_STATUSES =
            List.of(FacilityBookingStatus.CONFIRMED, FacilityBookingStatus.CHECKED_IN);

    private final FacilityRepository facilityRepository;
    private final FacilitySlotRepository facilitySlotRepository;
    private final FacilityBookingRepository facilityBookingRepository;
    private final FacilityMaintenanceRepository facilityMaintenanceRepository;
    private final ReservationRepository reservationRepository;
    private final GuestRepository guestRepository;
    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;
    private final ChargeService chargeService;
    private final FacilityWebSocketPublisher facilityWebSocketPublisher;
    private final ObjectMapper objectMapper;

    public FacilityService(
            FacilityRepository facilityRepository,
            FacilitySlotRepository facilitySlotRepository,
            FacilityBookingRepository facilityBookingRepository,
            FacilityMaintenanceRepository facilityMaintenanceRepository,
            ReservationRepository reservationRepository,
            GuestRepository guestRepository,
            HotelRepository hotelRepository,
            TenantAccessService tenantAccessService,
            ChargeService chargeService,
            FacilityWebSocketPublisher facilityWebSocketPublisher,
            ObjectMapper objectMapper) {
        this.facilityRepository = facilityRepository;
        this.facilitySlotRepository = facilitySlotRepository;
        this.facilityBookingRepository = facilityBookingRepository;
        this.facilityMaintenanceRepository = facilityMaintenanceRepository;
        this.reservationRepository = reservationRepository;
        this.guestRepository = guestRepository;
        this.hotelRepository = hotelRepository;
        this.tenantAccessService = tenantAccessService;
        this.chargeService = chargeService;
        this.facilityWebSocketPublisher = facilityWebSocketPublisher;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public FacilityDtos.FacilityBookingResponse createBooking(
            UUID hotelId, String hotelHeader, UUID facilityId, FacilityDtos.FacilityBookingRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        FacilitySlot slot = facilitySlotRepository
                .findByIdAndFacility_Id(req.slotId(), facilityId)
                .orElseThrow(() -> notFound("Slot"));
        if (slot.getStatus() == FacilitySlotStatus.CLOSED
                || slot.getStatus() == FacilitySlotStatus.MAINTENANCE) {
            throw new ApiException(HttpStatus.CONFLICT, "Slot is not bookable");
        }
        long occupied =
                facilityBookingRepository.sumGuestCountOnSlot(slot.getId(), OCCUPYING_STATUSES);
        if (occupied + req.guestCount() > slot.getMaxBookings()) {
            throw new ApiException(HttpStatus.CONFLICT, "Slot capacity exceeded");
        }

        Reservation reservation = null;
        Guest guest;
        if (req.reservationId() != null) {
            reservation = reservationRepository
                    .findByIdAndHotel_Id(req.reservationId(), hotelId)
                    .orElseThrow(() -> notFound("Reservation"));
            guest = reservation.getGuest();
        } else {
            guest = resolveWalkInGuest(hotelId, req.guest());
        }

        BigDecimal unitPrice =
                facility.getBasePrice() != null ? facility.getBasePrice() : BigDecimal.ZERO;
        BigDecimal amount = unitPrice.multiply(BigDecimal.valueOf(req.guestCount())).setScale(2, RoundingMode.HALF_UP);

        String ref = generateBookingRef(facility.getType().name());
        String accessCode = "FAC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase() + "-" + Year.now();
        String qr = QrCodeUtil.toPngDataUri(accessCode);

        FacilityBooking b = new FacilityBooking();
        b.setFacility(facility);
        b.setSlot(slot);
        b.setReservation(reservation);
        b.setGuest(guest);
        b.setBookingReference(ref);
        b.setGuestCount(req.guestCount());
        b.setSpecialRequests(req.specialRequests());
        b.setChargeToRoom(req.chargeToRoom());
        b.setAccessCode(accessCode);
        b.setQrCode(qr);
        b.setAmountPaid(BigDecimal.ZERO);
        b.setPaymentStatus(FacilityPaymentStatus.PENDING);
        b.setStatus(FacilityBookingStatus.CONFIRMED);

        b = facilityBookingRepository.save(b);

        RoomCharge linkedCharge = null;
        if (req.chargeToRoom()) {
            if (reservation == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "reservationId required when chargeToRoom is true");
            }
            if (reservation.getStatus() != ReservationStatus.CHECKED_IN) {
                throw new ApiException(
                        HttpStatus.CONFLICT, "chargeToRoom requires a CHECKED_IN reservation (guest on property)");
            }
            linkedCharge = postRecreationCharge(hotelId, reservation, facility, amount, b.getId(), null);
            b.setRoomCharge(linkedCharge);
            b.setAmountPaid(amount);
            b.setPaymentStatus(FacilityPaymentStatus.PAID);
            b = facilityBookingRepository.save(b);
        } else if (req.payment() != null
                && req.payment().amount() != null
                && req.payment().amount().signum() > 0) {
            b.setAmountPaid(req.payment().amount().setScale(2, RoundingMode.HALF_UP));
            b.setPaymentStatus(FacilityPaymentStatus.PAID);
            b = facilityBookingRepository.save(b);
        } else if (amount.signum() == 0) {
            b.setPaymentStatus(FacilityPaymentStatus.PAID);
            b = facilityBookingRepository.save(b);
        }

        long newOcc = occupied + req.guestCount();
        slot.setCurrentBookings((int) newOcc);
        if (newOcc >= slot.getMaxBookings()) {
            slot.setStatus(FacilitySlotStatus.BOOKED);
        }
        facilitySlotRepository.save(slot);

        Instant allowedUntil =
                slot.getStartTime().atZone(ZoneOffset.UTC).toInstant().minus(2, ChronoUnit.HOURS);
        String cancelPath = "/api/v1/hotels/" + hotelId + "/facilities/bookings/" + b.getId() + "/cancel";

        return new FacilityDtos.FacilityBookingResponse(
                b.getId(),
                ref,
                b.getStatus().name(),
                new FacilityDtos.FacilityNameSlot(
                        facility.getName(),
                        new FacilityDtos.FacilitySlotInfo(
                                slot.getStartTime().atZone(ZoneOffset.UTC).toInstant(),
                                slot.getEndTime().atZone(ZoneOffset.UTC).toInstant())),
                req.guestCount(),
                new FacilityDtos.FacilityAccessDto(
                        qr,
                        accessCode,
                        "Show QR code or access code at facility entrance. Arrive 5 minutes early."),
                new FacilityDtos.FacilityChargesDto(
                        amount,
                        req.chargeToRoom(),
                        linkedCharge != null ? linkedCharge.getId() : null),
                new FacilityDtos.FacilityCancellationDto(allowedUntil, cancelPath));
    }

    private RoomCharge postRecreationCharge(
            UUID hotelId,
            Reservation reservation,
            Facility facility,
            BigDecimal amount,
            UUID bookingId,
            String postedByOverride) {
        String meta;
        try {
            meta = objectMapper.writeValueAsString(Map.of("facilityBookingId", bookingId.toString()));
        } catch (JsonProcessingException e) {
            meta = null;
        }
        String who = postedByOverride != null && !postedByOverride.isBlank()
                ? postedByOverride.trim()
                : tenantAccessService.currentUser().getUsername();
        return chargeService.postFolioCharge(
                hotelId,
                reservation,
                amount,
                facility.getName() + " — facility booking",
                ChargeType.RECREATION,
                who,
                meta);
    }

    @Transactional
    public FacilityDtos.FacilityCheckInResponse checkInBooking(
            UUID hotelId, String hotelHeader, UUID bookingId, FacilityDtos.FacilityCheckInRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FacilityBooking b = facilityBookingRepository
                .findByIdAndFacility_Hotel_Id(bookingId, hotelId)
                .orElseThrow(() -> notFound("Booking"));
        if (b.getStatus() != FacilityBookingStatus.CONFIRMED) {
            throw new ApiException(HttpStatus.CONFLICT, "Booking cannot be checked in");
        }
        if (req.accessCode() == null || !req.accessCode().equals(b.getAccessCode())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid access code");
        }
        int actual = req.actualGuestCount() != null ? req.actualGuestCount() : b.getGuestCount();
        if (actual > b.getGuestCount()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "actualGuestCount exceeds booked guest count");
        }
        b.setStatus(FacilityBookingStatus.CHECKED_IN);
        b.setCheckedInAt(Instant.now());
        facilityBookingRepository.save(b);

        Facility facility = b.getFacility();
        Long occL = facilityBookingRepository.sumCheckedInGuestCountByFacilityId(
                facility.getId(), FacilityBookingStatus.CHECKED_IN);
        int occ = occL != null ? occL.intValue() : 0;
        int cap = facility.getMaxCapacity() != null ? facility.getMaxCapacity() : Integer.MAX_VALUE;
        int remaining = Math.max(0, cap - occ);

        facilityWebSocketPublisher.publishOccupancy(hotelId, facility.getId(), occ, cap);

        Map<String, Object> data = new HashMap<>();
        data.put("facilityId", facility.getId().toString());
        data.put("occupancy", occ);
        data.put("capacity", cap);
        FacilityDtos.FacilityOccupancyBroadcast broadcast =
                new FacilityDtos.FacilityOccupancyBroadcast("facility.occupancy.updated", data);

        return new FacilityDtos.FacilityCheckInResponse(
                b.getId(),
                b.getStatus().name(),
                b.getCheckedInAt(),
                new FacilityDtos.FacilityOccupancyInfo(facility.getName(), occ, remaining),
                broadcast);
    }

    @Transactional
    public FacilityDtos.ChargeFacilityToRoomResponse chargeToRoom(
            UUID hotelId, String hotelHeader, UUID bookingId, FacilityDtos.ChargeFacilityToRoomRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FacilityBooking b = facilityBookingRepository
                .findByIdAndFacility_Hotel_Id(bookingId, hotelId)
                .orElseThrow(() -> notFound("Booking"));
        if (b.getReservation() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Booking has no hotel reservation to charge");
        }
        if (b.getReservation().getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ApiException(HttpStatus.CONFLICT, "Only CHECKED_IN room reservations can be charged");
        }
        if (b.getRoomCharge() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "Room charge already linked to this booking");
        }
        BigDecimal amount = b.getAmountPaid() != null && b.getAmountPaid().signum() > 0
                ? b.getAmountPaid()
                : (b.getFacility().getBasePrice() != null
                        ? b.getFacility()
                                .getBasePrice()
                                .multiply(BigDecimal.valueOf(b.getGuestCount()))
                                .setScale(2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO);
        RoomCharge c =
                postRecreationCharge(hotelId, b.getReservation(), b.getFacility(), amount, b.getId(), req.postedBy());
        b.setRoomCharge(c);
        b.setChargeToRoom(true);
        b.setPaymentStatus(FacilityPaymentStatus.PAID);
        facilityBookingRepository.save(b);

        Map<String, Object> folioPayload =
                Map.of("type", "folio.charge.added", "chargeId", c.getId().toString(), "amount", c.getAmount());
        facilityWebSocketPublisher.publishFolioCharge(b.getReservation().getId(), folioPayload);

        return new FacilityDtos.ChargeFacilityToRoomResponse(
                c.getId(), b.getReservation().getId(), c.getDescription(), c.getAmount(), c.getChargedAt());
    }

    @Transactional
    public void cancelBooking(UUID hotelId, String hotelHeader, UUID bookingId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FacilityBooking b = facilityBookingRepository
                .findByIdAndFacility_Hotel_Id(bookingId, hotelId)
                .orElseThrow(() -> notFound("Booking"));
        if (b.getStatus() == FacilityBookingStatus.CANCELLED) {
            return;
        }
        if (b.getStatus() == FacilityBookingStatus.CHECKED_IN || b.getStatus() == FacilityBookingStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "Cannot cancel this booking in its current state");
        }
        b.setStatus(FacilityBookingStatus.CANCELLED);
        facilityBookingRepository.save(b);
        FacilitySlot slot = b.getSlot();
        long occ = facilityBookingRepository.sumGuestCountOnSlot(slot.getId(), OCCUPYING_STATUSES);
        slot.setCurrentBookings((int) occ);
        if (occ < slot.getMaxBookings()) {
            slot.setStatus(FacilitySlotStatus.AVAILABLE);
        }
        facilitySlotRepository.save(slot);
    }

    @Transactional
    public FacilityDtos.FacilityMaintenanceResponse reportMaintenance(
            UUID hotelId, String hotelHeader, UUID facilityId, FacilityDtos.FacilityMaintenanceRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        FacilityMaintenance m = new FacilityMaintenance();
        m.setFacility(facility);
        m.setTitle(req.title());
        m.setDescription(req.description());
        m.setReportedBy(tenantAccessService.currentUser().getUsername());
        m.setPriority(parsePriority(req.priority()));
        m.setScheduledStart(req.scheduledStart());
        if (req.scheduledStart() != null && req.estimatedDurationMinutes() != null) {
            m.setScheduledEnd(req.scheduledStart().plus(req.estimatedDurationMinutes(), ChronoUnit.MINUTES));
        }
        m.setCost(req.cost());
        m.setAffectedSlotIds(req.affectedSlots() != null ? new ArrayList<>(req.affectedSlots()) : new ArrayList<>());
        m.setStatus(FacilityMaintenanceStatus.SCHEDULED);
        m = facilityMaintenanceRepository.save(m);

        int blocked = 0;
        List<FacilityDtos.AffectedBookingNotice> notices = new ArrayList<>();
        if (req.affectedSlots() != null) {
            for (UUID sid : req.affectedSlots()) {
                var optSlot = facilitySlotRepository.findByIdAndFacility_Hotel_Id(sid, hotelId);
                if (optSlot.isEmpty()) {
                    continue;
                }
                FacilitySlot slot = optSlot.get();
                slot.setStatus(FacilitySlotStatus.MAINTENANCE);
                facilitySlotRepository.save(slot);
                blocked++;
                List<FacilityBooking> bookings =
                        facilityBookingRepository.findBySlot_IdAndStatus(sid, FacilityBookingStatus.CONFIRMED);
                for (FacilityBooking bb : bookings) {
                    bb.setStatus(FacilityBookingStatus.CANCELLED);
                    facilityBookingRepository.save(bb);
                    String alt = bb.getSlot().getEndTime() != null
                            ? bb.getSlot().getEndTime().atZone(ZoneOffset.UTC).toInstant().toString()
                            : null;
                    notices.add(new FacilityDtos.AffectedBookingNotice(
                            bb.getId(),
                            bb.getGuest().getEmail() != null ? bb.getGuest().getEmail() : "",
                            true,
                            alt));
                }
            }
        }
        String noticeMsg = "Facility maintenance scheduled. Alternative slots may be available.";
        return new FacilityDtos.FacilityMaintenanceResponse(
                m.getId(),
                m.getStatus().name(),
                blocked,
                notices,
                new FacilityDtos.FacilityPublicNotice(true, noticeMsg));
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.FacilityMaintenanceListItem> listMaintenance(
            UUID hotelId, String hotelHeader, UUID facilityId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        return facilityMaintenanceRepository.findByFacility_IdOrderByCreatedAtDesc(facilityId).stream()
                .map(m -> new FacilityDtos.FacilityMaintenanceListItem(
                        m.getId(),
                        m.getTitle(),
                        m.getDescription(),
                        m.getPriority().name(),
                        m.getStatus().name(),
                        m.getScheduledStart(),
                        m.getScheduledEnd(),
                        m.getCost(),
                        m.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.FacilitySummary> listFacilities(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return facilityRepository.findByHotel_IdOrderByNameAsc(hotelId).stream()
                .map(f -> new FacilityDtos.FacilitySummary(
                        f.getId(), f.getName(), f.getCode(), f.getType().name()))
                .toList();
    }

    @Transactional(readOnly = true)
    public FacilityDtos.FacilityDashboardResponse dashboard(
            UUID hotelId, String hotelHeader, UUID facilityId, LocalDate fromDate, LocalDate toDate) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));

        LocalDate from = fromDate != null ? fromDate : LocalDate.now();
        LocalDate to = toDate != null ? toDate : from.plusDays(7);
        if (to.isBefore(from)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "toDate must be on/after fromDate");
        }
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();

        List<FacilitySlot> slots =
                facilitySlotRepository.findByFacility_IdAndStartTimeBetweenOrderByStartTimeAsc(facilityId, start, end);
        List<FacilityBooking> bookings = facilityBookingRepository.findForFacilityWindow(facilityId, start, end);

        int totalCapacity = slots.stream().mapToInt(FacilitySlot::getMaxBookings).sum();
        int occupied = slots.stream().mapToInt(FacilitySlot::getCurrentBookings).sum();
        int available = Math.max(0, totalCapacity - occupied);

        List<FacilityDtos.FacilitySlotCalendarItem> slotDtos = slots.stream()
                .map(s -> new FacilityDtos.FacilitySlotCalendarItem(
                        s.getId(),
                        s.getStartTime().atZone(ZoneOffset.UTC).toInstant(),
                        s.getEndTime().atZone(ZoneOffset.UTC).toInstant(),
                        s.getStatus().name(),
                        s.getMaxBookings(),
                        s.getCurrentBookings(),
                        Math.max(0, s.getMaxBookings() - s.getCurrentBookings())))
                .toList();

        List<FacilityDtos.FacilityBookingListItem> bookingDtos = bookings.stream()
                .map(b -> new FacilityDtos.FacilityBookingListItem(
                        b.getId(),
                        b.getBookingReference(),
                        b.getStatus().name(),
                        b.getGuest().getFullName(),
                        b.getGuestCount(),
                        b.getSlot().getStartTime().atZone(ZoneOffset.UTC).toInstant(),
                        b.getSlot().getEndTime().atZone(ZoneOffset.UTC).toInstant(),
                        b.getAccessCode()))
                .toList();

        return new FacilityDtos.FacilityDashboardResponse(
                facility.getId(), facility.getName(), from, to, totalCapacity, occupied, available, slotDtos, bookingDtos);
    }

    @Transactional
    public FacilityDtos.FacilityCreatedResponse createFacility(
            UUID hotelId, String hotelHeader, FacilityDtos.FacilityCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (!hotelRepository.existsById(hotelId)) {
            throw notFound("Hotel");
        }
        String code = req.code().trim();
        if (facilityRepository.existsByHotel_IdAndCodeIgnoreCase(hotelId, code)) {
            throw new ApiException(HttpStatus.CONFLICT, "Facility code already exists for this hotel: " + code);
        }
        Facility f = new Facility();
        f.setHotel(hotelRepository.getReferenceById(hotelId));
        f.setName(req.name().trim());
        f.setCode(code.toUpperCase());
        f.setDescription(req.description() != null ? req.description().trim() : null);
        f.setType(FacilityType.valueOf(req.type().trim().toUpperCase()));
        f.setMaxCapacity(req.maxCapacity() != null ? req.maxCapacity() : 30);
        f.setBasePrice(req.basePrice() != null ? req.basePrice().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        f.setRequiresAdvanceBooking(req.requiresAdvanceBooking() == null || req.requiresAdvanceBooking());
        f.setAllowsWalkIn(req.allowsWalkIn() == null || req.allowsWalkIn());
        f.setSlotDurationMinutes(60);
        f.setBufferMinutesBetweenSlots(0);
        f = facilityRepository.save(f);
        return new FacilityDtos.FacilityCreatedResponse(f.getId());
    }

    @Transactional
    public FacilityDtos.FacilitySlotResponse createSlot(
            UUID hotelId, String hotelHeader, UUID facilityId, FacilityDtos.FacilitySlotCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        LocalDateTime start;
        LocalDateTime end;
        try {
            start = LocalDateTime.parse(req.startTime().trim());
            end = LocalDateTime.parse(req.endTime().trim());
        } catch (DateTimeParseException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "startTime and endTime must be ISO-8601 local date-times");
        }
        if (!end.isAfter(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "endTime must be after startTime");
        }
        FacilitySlot slot = new FacilitySlot();
        slot.setFacility(facility);
        slot.setStartTime(start);
        slot.setEndTime(end);
        slot.setMaxBookings(Math.max(1, req.maxBookings()));
        slot.setStatus(FacilitySlotStatus.AVAILABLE);
        slot.setCurrentBookings(0);
        try {
            slot = facilitySlotRepository.save(slot);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Slot already exists for this facility at the selected start time. Choose a different start time.");
        }
        return new FacilityDtos.FacilitySlotResponse(
                slot.getId(),
                slot.getStartTime().atZone(ZoneOffset.UTC).toInstant(),
                slot.getEndTime().atZone(ZoneOffset.UTC).toInstant(),
                slot.getMaxBookings(),
                slot.getStatus().name());
    }

    private static FacilityPriority parsePriority(String p) {
        if (p == null || p.isBlank()) {
            return FacilityPriority.MEDIUM;
        }
        return FacilityPriority.valueOf(p.trim().toUpperCase());
    }

    private Guest resolveWalkInGuest(UUID hotelId, FacilityDtos.FacilityGuestRef g) {
        if (g == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "guest is required when reservationId is omitted");
        }
        Hotel hotel = hotelRepository.getReferenceById(hotelId);
        if (g.id() != null) {
            return guestRepository
                    .findByIdAndHotel_Id(g.id(), hotelId)
                    .orElseThrow(() -> notFound("Guest"));
        }
        if (g.firstName() == null || g.firstName().isBlank() || g.email() == null || g.email().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "guest.id or guest.firstName + guest.email required");
        }
        Guest guest = new Guest();
        guest.setHotel(hotel);
        guest.setFirstName(g.firstName().trim());
        guest.setLastName(g.lastName() != null && !g.lastName().isBlank() ? g.lastName().trim() : "Guest");
        guest.setFullName(g.firstName().trim() + " " + guest.getLastName());
        guest.setEmail(g.email().trim());
        guest.setPhone(g.phone());
        GuestProfileDefaults.ensureRequiredForPersistence(guest);
        return guestRepository.save(guest);
    }

    private static String generateBookingRef(String typePrefix) {
        return typePrefix + "-" + Year.now() + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase();
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
