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
import com.hms.entity.FacilityAbonnement;
import com.hms.entity.FacilityAbonnementFacility;
import com.hms.entity.FacilityBooking;
import com.hms.entity.FacilityIncident;
import com.hms.entity.FacilityMaintenance;
import com.hms.entity.FacilitySlot;
import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.LifeguardRoster;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.entity.WaterQualityLog;
import com.hms.repository.FacilityBookingRepository;
import com.hms.repository.FacilityAbonnementRepository;
import com.hms.repository.FacilityIncidentRepository;
import com.hms.repository.FacilityMaintenanceRepository;
import com.hms.repository.FacilityRepository;
import com.hms.repository.FacilitySlotRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.LifeguardRosterRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.WaterQualityLogRepository;
import com.hms.security.TenantAccessService;
import com.hms.util.QrCodeUtil;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Year;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Locale;
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
    private final FacilityAbonnementRepository facilityAbonnementRepository;
    private final FacilityMaintenanceRepository facilityMaintenanceRepository;
    private final WaterQualityLogRepository waterQualityLogRepository;
    private final LifeguardRosterRepository lifeguardRosterRepository;
    private final FacilityIncidentRepository facilityIncidentRepository;
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
            FacilityAbonnementRepository facilityAbonnementRepository,
            FacilityMaintenanceRepository facilityMaintenanceRepository,
            WaterQualityLogRepository waterQualityLogRepository,
            LifeguardRosterRepository lifeguardRosterRepository,
            FacilityIncidentRepository facilityIncidentRepository,
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
        this.facilityAbonnementRepository = facilityAbonnementRepository;
        this.facilityMaintenanceRepository = facilityMaintenanceRepository;
        this.waterQualityLogRepository = waterQualityLogRepository;
        this.lifeguardRosterRepository = lifeguardRosterRepository;
        this.facilityIncidentRepository = facilityIncidentRepository;
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
        BigDecimal invoiceAmount = ensureFacilityInvoice(b, actual);
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
                b.getInvoiceNumber(),
                invoiceAmount,
                new FacilityDtos.FacilityOccupancyInfo(facility.getName(), occ, remaining),
                broadcast);
    }

    private BigDecimal ensureFacilityInvoice(FacilityBooking booking, int actualGuestCount) {
        if (booking.getInvoiceNumber() != null && !booking.getInvoiceNumber().isBlank()) {
            return booking.getAmountPaid() != null ? booking.getAmountPaid() : BigDecimal.ZERO;
        }
        Facility facility = booking.getFacility();
        BigDecimal unitPrice = facility.getBasePrice() != null ? facility.getBasePrice() : BigDecimal.ZERO;
        BigDecimal amount = unitPrice
                .multiply(BigDecimal.valueOf(Math.max(1, actualGuestCount)))
                .setScale(2, RoundingMode.HALF_UP);
        if (amount.signum() > 0 && (booking.getAmountPaid() == null || booking.getAmountPaid().signum() == 0)) {
            booking.setAmountPaid(amount);
            booking.setPaymentStatus(FacilityPaymentStatus.PAID);
        }
        if (amount.signum() > 0) {
            booking.setInvoiceNumber(nextFacilityInvoiceNumber());
            booking.setInvoicedAt(Instant.now());
        }
        return amount;
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
                        b.getAccessCode(),
                        b.getInvoiceNumber(),
                        b.getAmountPaid()))
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
    public FacilityDtos.FacilityAbonnementRow createAbonnement(
            UUID hotelId, String hotelHeader, FacilityDtos.FacilityAbonnementCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (req.validUntil().isBefore(req.validFrom())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "validUntil must be on/after validFrom");
        }
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String code = normalizeAbonnementCode(
                req.code() != null && !req.code().isBlank()
                        ? req.code()
                        : "ABO-" + Year.now() + "-" + UUID.randomUUID().toString().substring(0, 6));
        if (facilityAbonnementRepository.findByHotel_IdAndCodeIgnoreCase(hotelId, code).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "Abonnement code already exists");
        }
        FacilityAbonnement a = new FacilityAbonnement();
        a.setHotel(hotel);
        a.setMemberName(req.memberName().trim());
        a.setCompanyName(cleanNullable(req.companyName()));
        a.setCode(code);
        a.setContactEmail(cleanNullable(req.contactEmail()));
        a.setContactPhone(cleanNullable(req.contactPhone()));
        a.setValidFrom(req.validFrom());
        a.setValidUntil(req.validUntil());
        a.setVisitLimit(req.visitLimit());
        a.setMonthlyBilling(Boolean.TRUE.equals(req.monthlyBilling()));
        a.setActive(true);

        for (UUID facilityId : req.facilityIds() == null ? List.<UUID>of() : req.facilityIds()) {
            Facility facility = facilityRepository
                    .findByIdAndHotel_Id(facilityId, hotelId)
                    .orElseThrow(() -> notFound("Facility"));
            FacilityAbonnementFacility af = new FacilityAbonnementFacility();
            af.setAbonnement(a);
            af.setFacility(facility);
            a.getAllowedFacilities().add(af);
        }
        a = facilityAbonnementRepository.save(a);
        return toAbonnementRow(a);
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.FacilityAbonnementRow> listAbonnements(UUID hotelId, String hotelHeader, String q) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String query = q == null ? "" : q.trim();
        List<FacilityAbonnement> rows = query.isBlank()
                ? facilityAbonnementRepository.findDetailedByHotelId(hotelId)
                : facilityAbonnementRepository.searchDetailed(hotelId, query);
        return rows.stream().map(this::toAbonnementRow).toList();
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.FacilityInvoiceRow> listFacilityInvoices(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return facilityBookingRepository.findInvoicedByHotelId(hotelId).stream()
                .map(b -> new FacilityDtos.FacilityInvoiceRow(
                        b.getId(),
                        b.getInvoiceNumber(),
                        b.getFacility().getName(),
                        b.getGuest().getFullName(),
                        b.getAmountPaid(),
                        b.getInvoicedAt()))
                .toList();
    }

    @Transactional
    public FacilityDtos.FacilityAbonnementCheckInResponse checkInAbonnement(
            UUID hotelId,
            String hotelHeader,
            UUID facilityId,
            FacilityDtos.FacilityAbonnementCheckInRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility = facilityRepository
                .findByIdAndHotel_Id(facilityId, hotelId)
                .orElseThrow(() -> notFound("Facility"));
        FacilitySlot slot = facilitySlotRepository
                .findByIdAndFacility_Id(req.slotId(), facilityId)
                .orElseThrow(() -> notFound("Slot"));
        FacilityAbonnement abonnement = resolveAbonnement(hotelId, req);
        validateAbonnementForFacility(abonnement, facility);
        int guestCount = req.guestCount() != null && req.guestCount() > 0 ? req.guestCount() : 1;
        if (abonnement.getVisitLimit() != null
                && abonnement.getVisitsUsed() + guestCount > abonnement.getVisitLimit()) {
            throw new ApiException(HttpStatus.CONFLICT, "Abonnement visit limit would be exceeded");
        }
        long occupied = facilityBookingRepository.sumGuestCountOnSlot(slot.getId(), OCCUPYING_STATUSES);
        if (occupied + guestCount > slot.getMaxBookings()) {
            throw new ApiException(HttpStatus.CONFLICT, "Slot capacity exceeded");
        }

        Guest guest = resolveAbonnementGuest(hotelId, abonnement);
        FacilityBooking booking = new FacilityBooking();
        booking.setFacility(facility);
        booking.setSlot(slot);
        booking.setGuest(guest);
        booking.setAbonnement(abonnement);
        booking.setBookingReference(generateBookingRef(facility.getType().name()));
        booking.setGuestCount(guestCount);
        booking.setSpecialRequests(cleanNullable(req.staffNotes()));
        booking.setAccessCode(abonnement.getCode());
        booking.setQrCode(QrCodeUtil.toPngDataUri(abonnement.getCode()));
        booking.setAmountPaid(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        booking.setPaymentStatus(FacilityPaymentStatus.PAID);
        booking.setStatus(FacilityBookingStatus.CHECKED_IN);
        booking.setCheckedInAt(Instant.now());
        booking = facilityBookingRepository.save(booking);

        abonnement.setVisitsUsed(abonnement.getVisitsUsed() + guestCount);
        facilityAbonnementRepository.save(abonnement);

        long newOcc = occupied + guestCount;
        slot.setCurrentBookings((int) newOcc);
        if (newOcc >= slot.getMaxBookings()) {
            slot.setStatus(FacilitySlotStatus.BOOKED);
        }
        facilitySlotRepository.save(slot);
        facilityWebSocketPublisher.publishOccupancy(hotelId, facility.getId(), (int) newOcc, slot.getMaxBookings());

        return new FacilityDtos.FacilityAbonnementCheckInResponse(
                booking.getId(),
                booking.getBookingReference(),
                booking.getStatus().name(),
                abonnement.getMemberName(),
                abonnement.getCode(),
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                abonnement.getVisitsUsed(),
                abonnement.getVisitLimit(),
                abonnement.isMonthlyBilling() ? "MONTHLY_COMPANY_BILLING" : "PREPAID_ABONNEMENT");
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

    // ── Water Quality ──────────────────────────────────────────────────────────

    @Transactional
    public FacilityDtos.WaterQualityLogItem logWaterQuality(
            UUID hotelId, String hotelHeader, UUID facilityId, FacilityDtos.WaterQualityLogRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        WaterQualityLog log = new WaterQualityLog();
        log.setFacility(facility);
        log.setLoggedBy(tenantAccessService.currentUser().getUsername());
        log.setPhLevel(req.phLevel());
        log.setFreeChlorinePpm(req.freeChlorinePpm());
        log.setCombinedChlorinePpm(req.combinedChlorinePpm());
        log.setTemperatureCelsius(req.temperatureCelsius());
        log.setTurbidityNtu(req.turbidityNtu());
        log.setTotalDissolvedSolids(req.totalDissolvedSolids());
        log.setAlkalinityPpm(req.alkalinityPpm());
        log.setCalciumHardnessPpm(req.calciumHardnessPpm());
        log.setNotes(req.notes());
        log.setPassedInspection(req.passedInspection());
        log.setInspectorName(req.inspectorName());
        log = waterQualityLogRepository.save(log);
        return toWaterQualityItem(log);
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.WaterQualityLogItem> listWaterQualityLogs(
            UUID hotelId, String hotelHeader, UUID facilityId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        return waterQualityLogRepository.findByFacility_IdOrderByLoggedAtDesc(facilityId).stream()
                .map(this::toWaterQualityItem)
                .toList();
    }

    private FacilityDtos.WaterQualityLogItem toWaterQualityItem(WaterQualityLog log) {
        return new FacilityDtos.WaterQualityLogItem(
                log.getId(), log.getLoggedAt(), log.getLoggedBy(),
                log.getPhLevel(), log.getFreeChlorinePpm(), log.getCombinedChlorinePpm(),
                log.getTemperatureCelsius(), log.getTurbidityNtu(), log.getTotalDissolvedSolids(),
                log.getAlkalinityPpm(), log.getCalciumHardnessPpm(), log.getNotes(),
                log.isPassedInspection(), log.getInspectorName(), log.getCreatedAt());
    }

    // ── Lifeguard Roster ───────────────────────────────────────────────────────

    @Transactional
    public FacilityDtos.LifeguardShiftItem createLifeguardShift(
            UUID hotelId, String hotelHeader, UUID facilityId, FacilityDtos.LifeguardShiftRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        LifeguardRoster roster = new LifeguardRoster();
        roster.setHotel(hotelRepository.getReferenceById(hotelId));
        roster.setFacility(facility);
        roster.setStaffName(req.staffName().trim());
        roster.setStaffEmail(req.staffEmail());
        roster.setCertificationName(req.certificationName());
        roster.setCertificationExpiry(req.certificationExpiry());
        try {
            roster.setShiftDate(LocalDate.parse(req.shiftDate()));
            roster.setShiftStart(LocalTime.parse(req.shiftStart()));
            roster.setShiftEnd(LocalTime.parse(req.shiftEnd()));
        } catch (DateTimeParseException e) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "shiftDate must be ISO date (yyyy-MM-dd) and shiftStart/shiftEnd must be ISO time (HH:mm)");
        }
        roster.setNotes(req.notes());
        roster = lifeguardRosterRepository.save(roster);
        return toLifeguardItem(roster);
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.LifeguardShiftItem> listLifeguardRoster(
            UUID hotelId, String hotelHeader, UUID facilityId, LocalDate shiftDate) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        List<LifeguardRoster> roster = shiftDate != null
                ? lifeguardRosterRepository.findByFacility_IdAndShiftDateOrderByShiftStartAsc(facilityId, shiftDate)
                : lifeguardRosterRepository.findByFacility_IdOrderByShiftDateDescShiftStartAsc(facilityId);
        return roster.stream().map(this::toLifeguardItem).toList();
    }

    private FacilityDtos.LifeguardShiftItem toLifeguardItem(LifeguardRoster r) {
        boolean expiringSoon = r.getCertificationExpiry() != null
                && r.getCertificationExpiry().isBefore(LocalDate.now().plusDays(30));
        return new FacilityDtos.LifeguardShiftItem(
                r.getId(), r.getStaffName(), r.getStaffEmail(),
                r.getCertificationName(), r.getCertificationExpiry(),
                r.getShiftDate(), r.getShiftStart(), r.getShiftEnd(),
                r.getStatus(), r.getNotes(), expiringSoon);
    }

    // ── Incidents ─────────────────────────────────────────────────────────────

    @Transactional
    public FacilityDtos.IncidentItem reportIncident(
            UUID hotelId, String hotelHeader, UUID facilityId, FacilityDtos.IncidentReportRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        FacilityIncident incident = new FacilityIncident();
        incident.setFacility(facility);
        incident.setOccurredAt(req.occurredAt() != null ? req.occurredAt() : Instant.now());
        incident.setTitle(req.title().trim());
        incident.setDescription(req.description());
        incident.setSeverity(req.severity() != null ? req.severity().toUpperCase() : "LOW");
        incident.setReportedBy(tenantAccessService.currentUser().getUsername());
        incident.setWitnessNames(req.witnessNames());
        incident = facilityIncidentRepository.save(incident);
        return toIncidentItem(incident);
    }

    @Transactional
    public FacilityDtos.IncidentItem resolveIncident(
            UUID hotelId, String hotelHeader, UUID incidentId, FacilityDtos.IncidentResolveRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FacilityIncident incident = facilityIncidentRepository
                .findByIdAndFacility_Hotel_Id(incidentId, hotelId)
                .orElseThrow(() -> notFound("Incident"));
        incident.setStatus("RESOLVED");
        incident.setResolution(req.resolution());
        incident.setResolvedBy(req.resolvedBy().trim());
        incident.setResolvedAt(Instant.now());
        incident = facilityIncidentRepository.save(incident);
        return toIncidentItem(incident);
    }

    @Transactional(readOnly = true)
    public List<FacilityDtos.IncidentItem> listIncidents(
            UUID hotelId, String hotelHeader, UUID facilityId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        return facilityIncidentRepository.findByFacility_IdOrderByOccurredAtDesc(facilityId).stream()
                .map(this::toIncidentItem)
                .toList();
    }

    private FacilityDtos.IncidentItem toIncidentItem(FacilityIncident i) {
        return new FacilityDtos.IncidentItem(
                i.getId(), i.getOccurredAt(), i.getTitle(), i.getDescription(),
                i.getSeverity(), i.getReportedBy(), i.getWitnessNames(),
                i.getStatus(), i.getResolution(), i.getResolvedAt(), i.getResolvedBy(), i.getCreatedAt());
    }

    // ── Maintenance completion ─────────────────────────────────────────────────

    @Transactional
    public FacilityDtos.MaintenanceCompleteResponse completeMaintenance(
            UUID hotelId, String hotelHeader, UUID maintenanceId, FacilityDtos.MaintenanceCompleteRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        FacilityMaintenance m = facilityMaintenanceRepository.findById(maintenanceId)
                .orElseThrow(() -> notFound("Maintenance"));
        if (!m.getFacility().getHotel().getId().equals(hotelId)) {
            throw notFound("Maintenance");
        }
        m.setStatus(FacilityMaintenanceStatus.COMPLETED);
        m.setCompletedAt(Instant.now());
        m.setCompletedBy(req.completedBy() != null ? req.completedBy().trim()
                : tenantAccessService.currentUser().getUsername());
        m.setInspectorNotes(req.inspectorNotes());
        m.setComplianceStatus(req.complianceStatus() != null ? req.complianceStatus().toUpperCase() : "PASSED");
        m = facilityMaintenanceRepository.save(m);
        return new FacilityDtos.MaintenanceCompleteResponse(
                m.getId(), m.getStatus().name(), m.getCompletedBy(), m.getComplianceStatus(), m.getCompletedAt());
    }

    // ── Revenue summary ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FacilityDtos.FacilityRevenueSummary getRevenueSummary(
            UUID hotelId, String hotelHeader, UUID facilityId, LocalDate fromDate, LocalDate toDate) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Facility facility =
                facilityRepository.findByIdAndHotel_Id(facilityId, hotelId).orElseThrow(() -> notFound("Facility"));
        LocalDate from = fromDate != null ? fromDate : LocalDate.now().withDayOfMonth(1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();

        long totalBookings = facilityBookingRepository.countActiveForFacilityWindow(facilityId, start, end);
        long checkedIn = facilityBookingRepository.countCheckedInByFacility(facilityId);
        BigDecimal totalRevenue = facilityBookingRepository.sumRevenueForFacilityWindow(facilityId, start, end);
        BigDecimal roomChargedRevenue = facilityBookingRepository.sumRoomChargedRevenueForFacilityWindow(facilityId, start, end);
        BigDecimal directRevenue = totalRevenue.subtract(roomChargedRevenue);

        return new FacilityDtos.FacilityRevenueSummary(
                facility.getId(), facility.getName(), from, to,
                (int) totalBookings, (int) checkedIn,
                totalRevenue, roomChargedRevenue, directRevenue);
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
        GuestProfileDefaults.ensureRequiredForPersistence(guest, hotel);
        return guestRepository.save(guest);
    }

    private FacilityAbonnement resolveAbonnement(
            UUID hotelId, FacilityDtos.FacilityAbonnementCheckInRequest req) {
        if (req.abonnementId() != null) {
            return facilityAbonnementRepository
                    .findByIdAndHotel_Id(req.abonnementId(), hotelId)
                    .orElseThrow(() -> notFound("Abonnement"));
        }
        if (req.code() != null && !req.code().isBlank()) {
            return facilityAbonnementRepository
                    .findByHotel_IdAndCodeIgnoreCase(hotelId, normalizeAbonnementCode(req.code()))
                    .orElseThrow(() -> notFound("Abonnement"));
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "abonnementId or code is required");
    }

    private void validateAbonnementForFacility(FacilityAbonnement a, Facility facility) {
        LocalDate today = LocalDate.now();
        if (!a.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT, "Abonnement is inactive");
        }
        if (today.isBefore(a.getValidFrom()) || today.isAfter(a.getValidUntil())) {
            throw new ApiException(HttpStatus.CONFLICT, "Abonnement is expired or not yet valid");
        }
        if (a.getVisitLimit() != null && a.getVisitsUsed() >= a.getVisitLimit()) {
            throw new ApiException(HttpStatus.CONFLICT, "Abonnement visit limit reached");
        }
        boolean allowed = a.getAllowedFacilities().isEmpty()
                || a.getAllowedFacilities().stream()
                        .anyMatch(af -> af.getFacility().getId().equals(facility.getId()));
        if (!allowed) {
            throw new ApiException(HttpStatus.CONFLICT, "Abonnement is not allowed for this facility");
        }
    }

    private Guest resolveAbonnementGuest(UUID hotelId, FacilityAbonnement a) {
        String email = a.getContactEmail();
        final String resolvedEmail = email == null || email.isBlank()
                ? a.getCode().toLowerCase(Locale.ROOT) + "@abonnement.local"
                : email.trim();
        return guestRepository.findByHotel_IdAndEmailIgnoreCase(hotelId, resolvedEmail)
                .orElseGet(() -> {
                    Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
                    String[] names = a.getMemberName().trim().split("\\s+", 2);
                    Guest guest = new Guest();
                    guest.setHotel(hotel);
                    guest.setFirstName(names[0]);
                    guest.setLastName(names.length > 1 ? names[1] : "Member");
                    guest.setFullName(a.getMemberName().trim());
                    guest.setEmail(resolvedEmail);
                    guest.setPhone(a.getContactPhone());
                    guest.setGuestType("ABONNEMENT");
                    guest.setCorporateCompanyName(a.getCompanyName());
                    guest.setCorporateAccountCode(a.getCode());
                    GuestProfileDefaults.ensureRequiredForPersistence(guest, hotel);
                    return guestRepository.save(guest);
                });
    }

    private FacilityDtos.FacilityAbonnementRow toAbonnementRow(FacilityAbonnement a) {
        List<FacilityDtos.FacilitySummary> facilities = a.getAllowedFacilities().stream()
                .map(af -> new FacilityDtos.FacilitySummary(
                        af.getFacility().getId(),
                        af.getFacility().getName(),
                        af.getFacility().getCode(),
                        af.getFacility().getType().name()))
                .toList();
        return new FacilityDtos.FacilityAbonnementRow(
                a.getId(),
                a.getMemberName(),
                a.getCompanyName(),
                a.getCode(),
                a.getContactEmail(),
                a.getContactPhone(),
                a.getValidFrom(),
                a.getValidUntil(),
                a.getVisitLimit(),
                a.getVisitsUsed(),
                a.isMonthlyBilling(),
                a.isActive(),
                facilities);
    }

    private static String normalizeAbonnementCode(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_-]", "");
        if (value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid abonnement code");
        }
        return value;
    }

    private static String cleanNullable(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private static String generateBookingRef(String typePrefix) {
        return typePrefix + "-" + Year.now() + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase();
    }

    private String nextFacilityInvoiceNumber() {
        String year = String.valueOf(Year.now().getValue());
        int next = facilityBookingRepository.findMaxFacilityInvoiceSuffixForYear(year) + 1;
        return "FAC-" + year + "-" + String.format("%06d", next);
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
