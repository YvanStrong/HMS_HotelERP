package com.hms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.GuestDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.CleanlinessStatus;
import com.hms.domain.FolioStatus;
import com.hms.domain.ReservationStatus;
import com.hms.domain.Role;
import com.hms.domain.RoomStatus;
import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.Invoice;
import com.hms.entity.InvoiceLineItem;
import com.hms.entity.Payment;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.entity.RoomCharge;
import com.hms.entity.RoomType;
import com.hms.events.RoomCheckedOutEvent;
import com.hms.entity.RoomTypeNightlyRate;
import com.hms.repository.AppUserRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InvoiceRepository;
import com.hms.repository.PaymentRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomBlockRepository;
import com.hms.repository.RoomChargeRepository;
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
import java.time.Year;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReservationService {

    private static final BigDecimal TAX_RATE = new BigDecimal("0.15");
    private static final BigDecimal FEE_PER_NIGHT = new BigDecimal("10.00");

    private final HotelRepository hotelRepository;
    private final RoomRepository roomRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;
    private final RoomChargeRepository roomChargeRepository;
    private final InvoiceRepository invoiceRepository;
    private final TenantAccessService tenantAccessService;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final RoomBlockRepository roomBlockRepository;
    private final RoomTypeNightlyRateRepository roomTypeNightlyRateRepository;
    private final RoomStatusAuditService roomStatusAuditService;
    private final AppUserRepository appUserRepository;
    private final ChargeService chargeService;
    private final HousekeepingTaskService housekeepingTaskService;
    private final NotificationService notificationService;
    private final PaymentRepository paymentRepository;
    private final InvoicePdfService invoicePdfService;

    public ReservationService(
            HotelRepository hotelRepository,
            RoomRepository roomRepository,
            RoomTypeRepository roomTypeRepository,
            GuestRepository guestRepository,
            ReservationRepository reservationRepository,
            RoomChargeRepository roomChargeRepository,
            InvoiceRepository invoiceRepository,
            TenantAccessService tenantAccessService,
            ApplicationEventPublisher eventPublisher,
            ObjectMapper objectMapper,
            RoomBlockRepository roomBlockRepository,
            RoomTypeNightlyRateRepository roomTypeNightlyRateRepository,
            RoomStatusAuditService roomStatusAuditService,
            AppUserRepository appUserRepository,
            ChargeService chargeService,
            HousekeepingTaskService housekeepingTaskService,
            NotificationService notificationService,
            PaymentRepository paymentRepository,
            InvoicePdfService invoicePdfService) {
        this.hotelRepository = hotelRepository;
        this.roomRepository = roomRepository;
        this.roomTypeRepository = roomTypeRepository;
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.roomChargeRepository = roomChargeRepository;
        this.invoiceRepository = invoiceRepository;
        this.tenantAccessService = tenantAccessService;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.roomBlockRepository = roomBlockRepository;
        this.roomTypeNightlyRateRepository = roomTypeNightlyRateRepository;
        this.roomStatusAuditService = roomStatusAuditService;
        this.appUserRepository = appUserRepository;
        this.chargeService = chargeService;
        this.housekeepingTaskService = housekeepingTaskService;
        this.notificationService = notificationService;
        this.paymentRepository = paymentRepository;
        this.invoicePdfService = invoicePdfService;
    }

    @Transactional(readOnly = true)
    public ApiDtos.AvailabilityResponse availability(
            UUID hotelId, LocalDate checkIn, LocalDate checkOut, int adults, int children, UUID roomTypeId) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
        validateDates(checkIn, checkOut);
        int guests = adults + children;
        List<Room> candidates = findAssignableRooms(hotelId, roomTypeId, guests, checkIn, checkOut);
        List<ApiDtos.AvailabilityRoom> available = new ArrayList<>();
        for (Room room : candidates) {
            if (reservationRepository.countOverlapping(room.getId(), checkIn, checkOut, null) == 0) {
                BigDecimal avgNightly = averageNightlyForStay(
                        hotelId,
                        room.getRoomType().getId(),
                        checkIn,
                        checkOut,
                        room.getRoomType().getBaseRate());
                available.add(new ApiDtos.AvailabilityRoom(
                        room.getId(), room.getRoomNumber(), room.getFloor(), avgNightly));
            }
        }
        available.sort(Comparator.comparing(ApiDtos.AvailabilityRoom::rate));
        BigDecimal baseRate = available.isEmpty()
                ? resolveBaseRate(hotelId, roomTypeId)
                : available.get(0).rate();
        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        BigDecimal taxes = baseRate.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal fees = FEE_PER_NIGHT.multiply(BigDecimal.valueOf(nights)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalPerNight =
                baseRate.add(taxes).add(FEE_PER_NIGHT).setScale(2, RoundingMode.HALF_UP);
        List<ApiDtos.AltDate> alt = new ArrayList<>();
        if (available.isEmpty()) {
            for (int d = 1; d <= 5; d++) {
                LocalDate altIn = checkIn.plusDays(d);
                LocalDate altOut = altIn.plusDays(nights);
                List<Room> loose = findAssignableRooms(hotelId, null, guests, altIn, altOut);
                boolean ok = loose.stream()
                        .anyMatch(room -> reservationRepository.countOverlapping(
                                        room.getId(), altIn, altOut, null)
                                == 0);
                alt.add(new ApiDtos.AltDate(altIn, ok));
            }
        }
        String hint = buildAvailabilityHint(hotelId, roomTypeId, guests, available.isEmpty(), candidates);
        return new ApiDtos.AvailabilityResponse(
                !available.isEmpty(),
                available,
                alt,
                new ApiDtos.Pricing(baseRate, taxes, fees, totalPerNight),
                hint);
    }

    private String buildAvailabilityHint(
            UUID hotelId, UUID roomTypeId, int guests, boolean empty, List<Room> typedCandidates) {
        if (!empty) {
            return null;
        }
        long physical = roomRepository.countByHotel_Id(hotelId);
        if (physical == 0) {
            return "This property has no rooms in inventory yet. In the hotel console, open Rooms and create at least one room.";
        }
        if (roomTypeId != null && roomRepository.countByHotel_IdAndRoomType_Id(hotelId, roomTypeId) == 0) {
            return "No physical rooms are linked to this room type. Link or create rooms for this category, or pick another room type.";
        }
        boolean partyFitsAnyRoom =
                roomRepository.findByHotel_Id(hotelId).stream()
                        .anyMatch(r -> r.getRoomType().getMaxOccupancy() >= guests);
        if (!partyFitsAnyRoom) {
            return "Guest count exceeds every room type's max occupancy at this property. Reduce adults/children or choose another hotel.";
        }
        if (typedCandidates.isEmpty()) {
            return "No vacant, sellable rooms for this category right now (reserved, blocked, out of order, or still in turnover). Try other dates or another room type.";
        }
        return "These dates overlap an existing stay or block for every matching room. Try the suggested check-in dates or another room category.";
    }

    private BigDecimal resolveBaseRate(UUID hotelId, UUID roomTypeId) {
        if (roomTypeId != null) {
            return roomTypeRepository
                    .findByIdAndHotel_Id(roomTypeId, hotelId)
                    .map(RoomType::getBaseRate)
                    .orElse(BigDecimal.ZERO);
        }
        return roomTypeRepository.findByHotel_Id(hotelId).stream()
                .map(RoomType::getBaseRate)
                .min(Comparator.naturalOrder())
                .orElse(BigDecimal.ZERO);
    }

    private List<Room> findAssignableRooms(
            UUID hotelId, UUID roomTypeId, int guests, LocalDate stayStart, LocalDate stayEnd) {
        List<Room> all = roomTypeId == null
                ? roomRepository.findByHotel_Id(hotelId)
                : roomRepository.findByHotel_IdAndRoomType_Id(hotelId, roomTypeId);
        List<Room> out = new ArrayList<>();
        for (Room r : all) {
            if (!RoomBookingEligibility.isVacantBookable(r)) {
                continue;
            }
            if (r.getRoomType().getMaxOccupancy() < guests) {
                continue;
            }
            if (stayStart != null
                    && stayEnd != null
                    && roomBlockRepository.countActiveOverlapping(r.getId(), stayStart, stayEnd) > 0) {
                continue;
            }
            out.add(r);
        }
        return out;
    }

    @Transactional
    public ApiDtos.CreateReservationResponse createReservation(
            UUID hotelId, String hotelHeader, ApiDtos.CreateReservationRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return createReservationWithActor(hotelId, req, auditActor(), false, Optional.empty());
    }

    /**
     * Direct web booking — optional JWT for {@link Role#GUEST}. Pricing is always computed server-side; payment from
     * client is ignored.
     */
    @Transactional
    public ApiDtos.CreateReservationResponse createReservationForPublic(
            UUID hotelId, ApiDtos.CreateReservationRequest req, Authentication authentication) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
        if (req.guest() != null) {
            if (req.guest().nationalId() == null || req.guest().nationalId().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "national_id is required");
            }
            if (req.guest().dateOfBirth() == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "date_of_birth is required");
            }
        }
        Optional<UserPrincipal> portal = Optional.empty();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal up) {
            if (up.getRole() == Role.GUEST) {
                if (up.getHotelId() == null || !up.getHotelId().equals(hotelId)) {
                    throw new ApiException(
                            HttpStatus.FORBIDDEN, "GUEST_TOKEN_HOTEL_MISMATCH", "Sign in for this property to book here");
                }
                portal = Optional.of(up);
            }
        }
        String actor = portal.map(UserPrincipal::getUsername).orElse("guest-web");
        return createReservationWithActor(hotelId, req, actor, true, portal);
    }

    public ApiDtos.CreateReservationRequest sanitizePublicBookingRequest(ApiDtos.CreateReservationRequest body) {
        if (body.guest() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "guest details are required");
        }
        ApiDtos.RatePlanInput rp = body.ratePlan() == null
                ? null
                : new ApiDtos.RatePlanInput(
                        null, body.ratePlan().includesBreakfast(), body.ratePlan().cancellationPolicy());
        return new ApiDtos.CreateReservationRequest(
                null,
                body.guest(),
                body.roomTypeId(),
                body.roomTypeCode(),
                null,
                body.checkInDate(),
                body.checkOutDate(),
                body.adults(),
                body.children(),
                body.specialRequests(),
                body.source() != null && !body.source().isBlank() ? body.source() : "web",
                rp,
                null);
    }

    private ApiDtos.CreateReservationResponse createReservationWithActor(
            UUID hotelId,
            ApiDtos.CreateReservationRequest req,
            String actor,
            boolean serverAuthoritativePricing,
            Optional<UserPrincipal> portalBooker) {
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        validateDates(req.checkInDate(), req.checkOutDate());
        int guests = req.adults() + (req.children() != null ? req.children() : 0);
        RoomType roomType = resolveRoomType(hotelId, req.roomTypeId(), req.roomTypeCode());
        if (roomType.getMaxOccupancy() < guests) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Occupancy exceeds room type capacity");
        }
        Guest guest = resolveGuest(hotel, req, portalBooker);
        long nights = ChronoUnit.DAYS.between(req.checkInDate(), req.checkOutDate());
        BigDecimal nightly;
        if (serverAuthoritativePricing) {
            nightly = averageNightlyForStay(
                    hotelId, roomType.getId(), req.checkInDate(), req.checkOutDate(), roomType.getBaseRate());
        } else {
            nightly = req.ratePlan() != null && req.ratePlan().nightlyRate() != null
                    ? req.ratePlan().nightlyRate()
                    : averageNightlyForStay(
                            hotelId,
                            roomType.getId(),
                            req.checkInDate(),
                            req.checkOutDate(),
                            roomType.getBaseRate());
        }
        BigDecimal total = nightly.multiply(BigDecimal.valueOf(nights)).setScale(2, RoundingMode.HALF_UP);

        Room room = pickRoom(hotelId, roomType.getId(), req.preferredRoomId(), req.checkInDate(), req.checkOutDate(), guests);

        Reservation r = new Reservation();
        r.setHotel(hotel);
        r.setRoom(room);
        r.setGuest(guest);
        r.setConfirmationCode(generateConfirmationCode());
        r.setBookingReference(nextBookingReference());
        r.setBookingSource(resolveBookingSource(req, portalBooker));
        r.setCheckInDate(req.checkInDate());
        r.setCheckOutDate(req.checkOutDate());
        r.setAdults(req.adults());
        r.setChildren(req.children() != null ? req.children() : 0);
        r.setNightlyRate(nightly);
        r.setTotalAmount(total);
        r.setStatus(ReservationStatus.CONFIRMED);
        r.setSpecialRequests(req.specialRequests());
        r.setSource(req.source() != null ? req.source() : "direct");
        if (req.ratePlan() != null) {
            r.setIncludesBreakfast(Boolean.TRUE.equals(req.ratePlan().includesBreakfast()));
            r.setCancellationPolicy(req.ratePlan().cancellationPolicy());
        }
        if (req.payment() != null) {
            r.setDepositAmount(req.payment().depositAmount());
            r.setDepositPaid(
                    Boolean.TRUE.equals(req.payment().depositRequired())
                            && req.payment().depositAmount() != null
                            && req.payment().depositAmount().signum() > 0);
            if (req.payment().paymentMethod() != null && !req.payment().paymentMethod().isBlank()) {
                r.setDepositPaymentMethod(req.payment().paymentMethod().trim().toUpperCase());
            }
        }
        portalBooker
                .filter(up -> up.getRole() == Role.GUEST)
                .ifPresent(up -> r.setBookedByAppUser(appUserRepository.getReferenceById(up.getId())));
        Reservation persisted = reservationRepository.save(r);

        RoomStatus roomPrevStatus = room.getStatus();
        CleanlinessStatus roomPrevClean = room.getCleanliness();
        room.setStatus(RoomStatus.RESERVED);
        room.setCurrentBooking(persisted);
        roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                roomPrevStatus,
                RoomStatus.RESERVED,
                roomPrevClean,
                roomPrevClean,
                actor,
                "Reservation confirmed");

        Guest g = persisted.getGuest();
        if (serverAuthoritativePricing) {
            notificationService.queueBookingConfirmationEmail(persisted);
        }

        return new ApiDtos.CreateReservationResponse(
                persisted.getId(),
                persisted.getConfirmationCode(),
                persisted.getBookingReference(),
                persisted.getStatus().name(),
                g.getId(),
                new ApiDtos.GuestBrief(
                        g.getId(),
                        g.getFullName() != null && !g.getFullName().isBlank()
                                ? g.getFullName().trim()
                                : g.getFirstName() + " " + g.getLastName(),
                        g.getEmail()),
                new ApiDtos.RoomAssign(room.getId(), room.getRoomNumber(), room.getFloor()),
                new ApiDtos.ReservationStayDates(persisted.getCheckInDate(), persisted.getCheckOutDate(), (int) nights),
                buildCreatePricing(persisted, nights),
                buildCancellationHint(persisted, hotelId),
                List.of(
                        "Reservation confirmed.",
                        "Post room charges after check-in via POST .../rooms/{roomId}/charges."),
                "Reservation confirmed. Booking reference "
                        + persisted.getBookingReference()
                        + ". Confirmation email queued.");
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.ReservationListItem> listReservationsForHotel(
            UUID hotelId,
            String hotelHeader,
            LocalDate stayStart,
            LocalDate stayEnd,
            String statusCsv,
            String q) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        List<ReservationStatus> statuses = parseReservationStatusFilter(statusCsv);
        String search = q != null && !q.isBlank() ? q.trim() : null;
        LocalDate from = stayStart != null ? stayStart : LocalDate.of(1900, 1, 1);
        LocalDate to = stayEnd != null ? stayEnd : LocalDate.of(2999, 12, 31);
        List<Reservation> rows =
                reservationRepository.searchForHotelStaff(hotelId, from, to, statuses, search);
        String currency = hotel.getCurrency();
        return rows.stream().map(r -> toReservationListItem(r, currency)).toList();
    }

    @Transactional(readOnly = true)
    public ApiDtos.PublicReservationLookupResponse lookupReservationPublic(
            UUID hotelId, String confirmation, String email) {
        if (confirmation == null || confirmation.isBlank() || email == null || email.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "confirmation and email are required");
        }
        Reservation r = reservationRepository
                .findByConfirmationCodeIgnoreCase(confirmation.trim())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (!r.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        if (r.getGuest().getEmail() == null
                || !r.getGuest().getEmail().equalsIgnoreCase(email.trim())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        List<RoomCharge> charges = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId());
        List<Payment> paymentsDb = paymentRepository.findByReservation_IdOrderByProcessedAtDesc(r.getId());
        ApiDtos.FolioSummary summary = computeFolioSummary(r, charges, paymentsDb);
        String roomTypeName = "";
        if (r.getRoom() != null && r.getRoom().getRoomType() != null) {
            roomTypeName = r.getRoom().getRoomType().getName();
        }
        return new ApiDtos.PublicReservationLookupResponse(
                r.getConfirmationCode(),
                r.getStatus().name(),
                r.getCheckInDate(),
                r.getCheckOutDate(),
                roomTypeName,
                r.getHotel().getName(),
                summary.balanceDue(),
                summary.currency());
    }

    private static ApiDtos.ReservationListItem toReservationListItem(Reservation r, String currency) {
        String roomNo = r.getRoom() != null ? r.getRoom().getRoomNumber() : "";
        boolean portalBooking =
                r.getBookedByAppUser() != null || r.getGuest().getPortalAccount() != null;
        int nights = (int) ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate());
        String guestDisplayName =
                r.getGuest().getFullName() != null && !r.getGuest().getFullName().isBlank()
                        ? r.getGuest().getFullName().trim()
                        : r.getGuest().getFirstName() + " " + r.getGuest().getLastName();
        String nid = r.getGuest().getNationalId() != null ? r.getGuest().getNationalId() : "";
        String masked =
                nid.length() <= 4 ? "****" : "****" + nid.substring(Math.max(0, nid.length() - 4));
        return new ApiDtos.ReservationListItem(
                r.getId(),
                r.getConfirmationCode(),
                r.getBookingReference(),
                r.getStatus().name(),
                r.getCheckInDate(),
                r.getCheckOutDate(),
                nights,
                guestDisplayName,
                masked,
                r.getGuest().getEmail(),
                roomNo.isBlank() ? "Unassigned" : roomNo,
                r.getTotalAmount(),
                currency,
                r.getBookingSource(),
                r.getCreatedAt(),
                portalBooking,
                r.getGuest().getId());
    }

    private static List<ReservationStatus> parseReservationStatusFilter(String statusCsv) {
        if (statusCsv == null || statusCsv.isBlank()) {
            return new ArrayList<>(EnumSet.allOf(ReservationStatus.class));
        }
        List<ReservationStatus> out = new ArrayList<>();
        for (String part : statusCsv.split(",")) {
            String t = part.trim().toUpperCase();
            if (t.isEmpty()) {
                continue;
            }
            try {
                out.add(ReservationStatus.valueOf(t));
            } catch (IllegalArgumentException ignored) {
                // skip unknown token
            }
        }
        return out.isEmpty() ? new ArrayList<>(EnumSet.allOf(ReservationStatus.class)) : out;
    }

    private ApiDtos.ReservationPricingSummary buildCreatePricing(Reservation r, long nights) {
        BigDecimal nightly = r.getNightlyRate();
        BigDecimal roomSub = r.getTotalAmount();
        BigDecimal taxes = roomSub.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal fees = FEE_PER_NIGHT.multiply(BigDecimal.valueOf(nights)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal depositPaid =
                r.isDepositPaid() && r.getDepositAmount() != null ? r.getDepositAmount() : BigDecimal.ZERO;
        BigDecimal balanceDue =
                roomSub.add(taxes).add(fees).subtract(depositPaid).setScale(2, RoundingMode.HALF_UP);
        return new ApiDtos.ReservationPricingSummary(nightly, roomSub, taxes, fees, depositPaid, balanceDue);
    }

    private static ApiDtos.CancellationHint buildCancellationHint(Reservation r, UUID hotelId) {
        String code = r.getCancellationPolicy() != null ? r.getCancellationPolicy() : "STANDARD";
        String summary = "Cancellation policy code: " + code + ". Contact the property for deadline details.";
        String hint = "/api/v1/hotels/" + hotelId + "/reservations/" + r.getId() + "/cancel";
        return new ApiDtos.CancellationHint(code, summary, hint);
    }

    private Guest resolveGuest(Hotel hotel, ApiDtos.CreateReservationRequest req, Optional<UserPrincipal> portalBooker) {
        if (portalBooker.isPresent() && portalBooker.get().getRole() == Role.GUEST) {
            Guest linked = guestRepository
                    .findByHotel_IdAndPortalAccount_Id(hotel.getId(), portalBooker.get().getId())
                    .orElseThrow(() -> new ApiException(
                            HttpStatus.BAD_REQUEST,
                            "GUEST_PROFILE_REQUIRED",
                            "Create a guest account for this hotel before booking while signed in."));
            if (req.guest() != null
                    && req.guest().email() != null
                    && !req.guest().email().isBlank()
                    && linked.getEmail() != null
                    && !linked.getEmail().equalsIgnoreCase(req.guest().email().trim())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Email must match your registered guest profile");
            }
            if (req.guest() != null && req.guest().phone() != null && !req.guest().phone().isBlank()) {
                linked.setPhone(req.guest().phone().trim());
                guestRepository.save(linked);
            }
            return linked;
        }
        if (req.guestId() != null) {
            Guest existing = guestRepository
                    .findByIdAndHotel_Id(req.guestId(), hotel.getId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Guest not found"));
            if (req.guest() != null) {
                GuestInputApplier.mergeGuestFromInput(hotel.getId(), existing, req.guest(), guestRepository);
                guestRepository.save(existing);
            }
            return existing;
        }
        if (req.guest() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "guestId or guest object required");
        }
        ApiDtos.GuestInput g = req.guest();
        if (g.nationalId() == null || g.nationalId().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "national_id is required");
        }
        if (g.dateOfBirth() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "date_of_birth is required");
        }
        guestRepository
                .findByHotel_IdAndNationalIdIgnoreCase(hotel.getId(), g.nationalId().trim())
                .ifPresent(
                        x -> {
                            throw new ApiException(
                                    HttpStatus.CONFLICT,
                                    "GUEST_NATIONAL_ID_EXISTS",
                                    "A guest with this national ID already exists for this hotel");
                        });
        Guest guest = new Guest();
        GuestInputApplier.populateNewGuest(hotel, guest, g);
        if (portalBooker.isEmpty()) {
            try {
                UserPrincipal actor = tenantAccessService.currentUser();
                if (actor.getRole() != Role.GUEST) {
                    guest.setCreatedBy(appUserRepository.getReferenceById(actor.getId()));
                }
            } catch (ApiException ignored) {
                // anonymous public booking
            }
        }
        return guestRepository.save(guest);
    }

    private Room pickRoom(
            UUID hotelId,
            UUID roomTypeId,
            UUID preferredRoomId,
            LocalDate checkIn,
            LocalDate checkOut,
            int guests) {
        if (preferredRoomId != null) {
            Room pref = roomRepository
                    .findByIdAndHotel_Id(preferredRoomId, hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Preferred room not found"));
            if (!pref.getRoomType().getId().equals(roomTypeId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Preferred room does not match room type");
            }
            ensureRoomAssignable(pref, checkIn, checkOut, guests);
            return pref;
        }
        List<Room> candidates = findAssignableRooms(hotelId, roomTypeId, guests, checkIn, checkOut);
        candidates.sort(Comparator.comparing(Room::getRoomNumber));
        for (Room room : candidates) {
            if (reservationRepository.countOverlapping(room.getId(), checkIn, checkOut, null) == 0) {
                return room;
            }
        }
        throw new ApiException(
                HttpStatus.CONFLICT,
                "No VACANT_CLEAN rooms for roomTypeId="
                        + roomTypeId
                        + " between "
                        + checkIn
                        + " and "
                        + checkOut
                        + " (hotelId="
                        + hotelId
                        + "). Add rooms of this type, free a room (check-out / cancel), use different dates, or set preferredRoomId if one room is free.");
    }

    private void ensureRoomAssignable(Room room, LocalDate checkIn, LocalDate checkOut, int guests) {
        if (room.getRoomType().getMaxOccupancy() < guests) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Room type capacity insufficient for guest count");
        }
        if (room.isOutOfOrder() || room.getStatus() == RoomStatus.OUT_OF_ORDER || room.getStatus() == RoomStatus.BLOCKED) {
            throw new ApiException(HttpStatus.CONFLICT, "Room is not available for assignment");
        }
        if (!RoomBookingEligibility.isVacantBookable(room)) {
            throw new ApiException(HttpStatus.CONFLICT, "Room is not available");
        }
        if (reservationRepository.countOverlapping(room.getId(), checkIn, checkOut, null) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Room is already reserved for overlapping dates");
        }
        if (roomBlockRepository.countActiveOverlapping(room.getId(), checkIn, checkOut) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Room has an active block overlapping these dates");
        }
    }

    private BigDecimal averageNightlyForStay(
            UUID hotelId, UUID roomTypeId, LocalDate checkIn, LocalDate checkOut, BigDecimal fallbackBase) {
        if (!checkIn.isBefore(checkOut)) {
            return fallbackBase;
        }
        RoomType rt = roomTypeRepository
                .findByIdAndHotel_Id(roomTypeId, hotelId)
                .orElse(null);
        BigDecimal base = rt != null ? rt.getBaseRate() : fallbackBase;
        BigDecimal sum = BigDecimal.ZERO;
        int n = 0;
        for (LocalDate d = checkIn; d.isBefore(checkOut); d = d.plusDays(1)) {
            n++;
            BigDecimal night =
                    roomTypeNightlyRateRepository.findByRoomType_IdAndRateDate(roomTypeId, d).map(RoomTypeNightlyRate::getNightlyRate).orElse(base);
            sum = sum.add(night);
        }
        if (n == 0) {
            return fallbackBase;
        }
        return sum.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
    }

    private String auditActor() {
        return tenantAccessService.currentUser().getUsername();
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.AssignmentSuggestionRoom> assignmentSuggestions(
            UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (r.getRoom() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Reservation has no room assigned");
        }
        Room current = r.getRoom();
        JsonNode prefs = parseGuestPreferenceNode(r.getGuest(), null);
        Integer prefFloor = extractPreferredFloor(prefs);
        LocalDate ci = r.getCheckInDate();
        LocalDate co = r.getCheckOutDate();
        int party = r.getAdults() + (r.getChildren() != null ? r.getChildren() : 0);
        List<Room> candidates = roomRepository.findByHotel_IdAndRoomType_Id(hotelId, current.getRoomType().getId());
        List<ApiDtos.AssignmentSuggestionRoom> scored = new ArrayList<>();
        for (Room cand : candidates) {
            if (!RoomBookingEligibility.isVacantBookable(cand)) {
                continue;
            }
            if (cand.getRoomType().getMaxOccupancy() < party) {
                continue;
            }
            if (reservationRepository.countOverlapping(cand.getId(), ci, co, r.getId()) > 0) {
                continue;
            }
            if (roomBlockRepository.countActiveOverlapping(cand.getId(), ci, co) > 0) {
                continue;
            }
            int f = cand.getFloor() != null ? cand.getFloor() : 0;
            int score = 50;
            String reason = "Available for stay window";
            if (prefFloor != null) {
                int dist = Math.abs(f - prefFloor);
                score = 100 - Math.min(dist * 5, 40);
                reason = "Floor distance " + dist + " vs preferred " + prefFloor;
            }
            scored.add(new ApiDtos.AssignmentSuggestionRoom(
                    cand.getId(), cand.getRoomNumber(), cand.getFloor(), score, reason));
        }
        scored.sort(Comparator.comparingInt(ApiDtos.AssignmentSuggestionRoom::score).reversed());
        return scored;
    }

    private String generateConfirmationCode() {
        return "HMS-" + Year.now().getValue() + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    private String nextBookingReference() {
        int y = Year.now(ZoneOffset.UTC).getValue();
        String prefixPattern = "HMS-" + y + "-%";
        int max = reservationRepository.maxBookingReferenceSuffixForYear(prefixPattern);
        return String.format("HMS-%d-%06d", y, max + 1);
    }

    private static String resolveBookingSource(
            ApiDtos.CreateReservationRequest req, Optional<UserPrincipal> portalBooker) {
        if (req.source() != null && !req.source().isBlank()) {
            String s = req.source().trim().toUpperCase().replace('-', '_');
            if ("WEB".equals(s) || "DIRECT".equals(s)) {
                return "GUEST_PORTAL";
            }
            return s;
        }
        if (portalBooker.isPresent() && portalBooker.get().getRole() == Role.GUEST) {
            return "GUEST_PORTAL";
        }
        return "FRONT_DESK";
    }

    private RoomType resolveRoomType(UUID hotelId, UUID roomTypeId, String roomTypeCode) {
        boolean hasId = roomTypeId != null;
        boolean hasCode = roomTypeCode != null && !roomTypeCode.isBlank();
        if (!hasId && !hasCode) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Provide roomTypeId (from GET .../room-types) or roomTypeCode (e.g. STD, DLX). Request hotelId="
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
                                    + "/room-types — ids from another hotel will not work, or send roomTypeCode that exists."));
        }
        return roomTypeRepository
                .findByHotel_IdAndCodeIgnoreCase(hotelId, roomTypeCode.trim())
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "No room type code "
                                + roomTypeCode.trim()
                                + " for hotelId="
                                + hotelId
                                + ". Create that type for this hotel or GET /api/v1/hotels/"
                                + hotelId
                                + "/room-types for valid codes and ids."));
    }

    @Transactional
    public ApiDtos.CheckInResponse checkIn(
            UUID hotelId, String hotelHeader, UUID reservationId, ApiDtos.CheckInRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal staff = tenantAccessService.currentUser();
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (r.getStatus() != ReservationStatus.CONFIRMED) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY, "RESERVATION_WRONG_STATUS", "Reservation must be CONFIRMED to check in");
        }
        if (!Boolean.TRUE.equals(req.guestIdVerified())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY, "GUEST_ID_NOT_VERIFIED", "Guest ID must be verified before check-in");
        }
        Hotel hotel = r.getHotel();
        Room room = r.getRoom();
        if (req.assignedRoomId() != null) {
            if (room != null && room.getId().equals(req.assignedRoomId())) {
                // Already assigned; skip re-assignment validation path.
            } else {
            Room nr = roomRepository
                    .findByIdAndHotel_Id(req.assignedRoomId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Assigned room not found"));
            ensureRoomAssignable(nr, r.getCheckInDate(), r.getCheckOutDate(), r.getAdults() + r.getChildren());
            if (room != null && !room.getId().equals(nr.getId())) {
                RoomStatus swappedFrom = room.getStatus();
                CleanlinessStatus swappedClean = room.getCleanliness();
                room.setStatus(RoomStatus.VACANT_CLEAN);
                room.setCurrentBooking(null);
                roomRepository.save(room);
                roomStatusAuditService.logTransition(
                        hotelId,
                        room,
                        swappedFrom,
                        RoomStatus.VACANT_CLEAN,
                        swappedClean,
                        swappedClean,
                        staff.getUsername(),
                        "Check-in reassignment: vacated previous room",
                        staff.getId());
            }
            room = nr;
            r.setRoom(room);
            }
        }
        if (room == null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "NO_ROOM_ASSIGNED", "Assign a room before check-in");
        }
        Instant checkInTime = req.actualCheckInTime() != null ? req.actualCheckInTime() : Instant.now();
        r.setActualCheckIn(checkInTime);
        r.setStatus(ReservationStatus.CHECKED_IN);
        r.setCheckedInBy(appUserRepository.getReferenceById(staff.getId()));
        r.setGuestIdVerified(true);
        r.setGuestIdVerifiedBy(appUserRepository.getReferenceById(staff.getId()));
        r.setFolioStatus(FolioStatus.OPEN);
        r.setFolioClosedAt(null);
        r.setEarlyCheckin(Boolean.TRUE.equals(req.isEarlyCheckin()));
        if (req.idVerification() != null) {
            Guest g = r.getGuest();
            g.setIdDocumentType(req.idVerification().documentType());
            g.setIdDocumentNumber(req.idVerification().documentNumber());
            guestRepository.save(g);
        }
        reservationRepository.save(r);

        if (Boolean.TRUE.equals(req.isEarlyCheckin())
                && hotel.getEarlyCheckinFee() != null
                && hotel.getEarlyCheckinFee().compareTo(BigDecimal.ZERO) > 0
                && (r.getEarlyCheckinFeeApplied() == null
                        || r.getEarlyCheckinFeeApplied().compareTo(BigDecimal.ZERO) == 0)) {
            chargeService.postFolioCharge(
                    hotelId,
                    r,
                    hotel.getEarlyCheckinFee(),
                    "Early check-in fee",
                    ChargeType.EARLY_CHECKIN,
                    staff.getUsername(),
                    null);
            r.setEarlyCheckinFeeApplied(hotel.getEarlyCheckinFee());
            reservationRepository.save(r);
        }

        RoomStatus preIn = room.getStatus();
        CleanlinessStatus preInClean = room.getCleanliness();
        room.setStatus(RoomStatus.OCCUPIED);
        room.setCurrentBooking(r);
        roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                preIn,
                RoomStatus.OCCUPIED,
                preInClean,
                preInClean,
                staff.getUsername(),
                "Guest checked in",
                staff.getId());

        housekeepingTaskService.onGuestCheckedIn(hotelId, room.getId(), r.getId());

        Instant validUntil = r.getCheckOutDate().atTime(11, 0).toInstant(ZoneOffset.UTC);
        String keyCode = "DK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase() + "-XJ9";
        ApiDtos.DigitalKey dk = new ApiDtos.DigitalKey(true, keyCode, checkInTime, validUntil);

        Guest guest = r.getGuest();
        ApiDtos.CheckInGuestInfo guestInfo = new ApiDtos.CheckInGuestInfo(
                guest.getFirstName() + " " + guest.getLastName(), true, checkInTime);

        ApiDtos.CheckInPaymentInfo paymentInfo = null;
        if (req.paymentMethod() != null) {
            ApiDtos.PaymentMethodInput pm = req.paymentMethod();
            BigDecimal preAuth = computeFolioSummary(
                            r,
                            roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId()),
                            paymentRepository.findByReservation_IdOrderByProcessedAtDesc(r.getId()))
                    .balanceDue();
            paymentInfo = new ApiDtos.CheckInPaymentInfo(
                    pm.type(),
                    pm.last4(),
                    pm.brand(),
                    "AUTH-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(),
                    preAuth);
        }

        ApiDtos.FolioSummary opening = computeFolioSummary(
                r,
                roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId()),
                paymentRepository.findByReservation_IdOrderByProcessedAtDesc(r.getId()));
        ApiDtos.FolioOpenedInfo folioOpened = new ApiDtos.FolioOpenedInfo(
                r.getId().toString(),
                "/api/v1/hotels/" + hotelId + "/reservations/" + r.getId() + "/folio",
                opening.balanceDue());

        Map<String, Object> broadcastPayload = new HashMap<>();
        broadcastPayload.put("reservationId", r.getId());
        broadcastPayload.put("roomId", room.getId());
        broadcastPayload.put("status", r.getStatus().name());
        ApiDtos.CheckInBroadcastInfo broadcast = new ApiDtos.CheckInBroadcastInfo(
                "GUEST_CHECKED_IN",
                List.of(
                        "hotel:" + hotelId + ":rooms",
                        "hotel:" + hotelId + ":reservations:" + r.getId()),
                broadcastPayload);

        return new ApiDtos.CheckInResponse(
                r.getId(),
                r.getStatus().name(),
                new ApiDtos.RoomStatusDto(
                        room.getId(), room.getRoomNumber(), room.getStatus().name(), room.getCleanliness().name()),
                guestInfo,
                paymentInfo,
                dk,
                folioOpened,
                broadcast,
                List.of(
                        "Room charges can now be posted via /api/v1/hotels/{hotelId}/rooms/{roomId}/charges",
                        "Guest can access mobile app features"));
    }

    @Transactional
    public ApiDtos.CheckOutResponse checkOut(
            UUID hotelId, String hotelHeader, UUID reservationId, ApiDtos.CheckOutRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal staff = tenantAccessService.currentUser();
        ApiDtos.CheckOutRequest b =
                req != null
                        ? req
                        : new ApiDtos.CheckOutRequest(null, null, null, null, null, null, null);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (r.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY, "RESERVATION_WRONG_STATUS", "Reservation must be CHECKED_IN to check out");
        }
        if (!Boolean.TRUE.equals(b.minibarInspected())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY, "MINIBAR_NOT_INSPECTED", "Minibar must be inspected before checkout");
        }
        if (invoiceRepository.existsByReservation_Id(r.getId())) {
            throw new ApiException(HttpStatus.CONFLICT, "Invoice already generated for this reservation");
        }
        List<RoomCharge> chargesPreview = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId());
        ApiDtos.FolioSummary folioBefore = computeFolioSummary(
                r, chargesPreview, paymentRepository.findByReservation_IdOrderByProcessedAtDesc(r.getId()));
        BigDecimal due = folioBefore.balanceDue();
        if (due.abs().compareTo(new BigDecimal("0.01")) > 0) {
            boolean override = Boolean.TRUE.equals(b.overrideBalanceWarning());
            boolean allowed =
                    staff.getRole() == Role.MANAGER
                            || staff.getRole() == Role.FINANCE
                            || staff.getRole() == Role.SUPER_ADMIN
                            || staff.getRole() == Role.HOTEL_ADMIN;
            if (!override || !allowed) {
                throw new ApiException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "FOLIO_BALANCE_DUE",
                        "Outstanding balance: " + due + " " + folioBefore.currency());
            }
        }
        Hotel hotel = r.getHotel();
        if (Boolean.TRUE.equals(b.isLateCheckout())
                && hotel.getLateCheckoutFee() != null
                && hotel.getLateCheckoutFee().compareTo(BigDecimal.ZERO) > 0) {
            chargeService.postFolioCharge(
                    hotelId,
                    r,
                    hotel.getLateCheckoutFee(),
                    "Late check-out fee",
                    ChargeType.LATE_CHECKOUT,
                    staff.getUsername(),
                    null);
            r.setLateCheckout(true);
            r.setLateCheckoutFeeApplied(hotel.getLateCheckoutFee());
            reservationRepository.save(r);
        }

        Instant checkoutTime = b.actualCheckOutTime() != null ? b.actualCheckOutTime() : Instant.now();
        r.setActualCheckOut(checkoutTime);
        r.setStatus(ReservationStatus.CHECKED_OUT);
        r.setCheckedOutBy(appUserRepository.getReferenceById(staff.getId()));
        r.setFolioStatus(FolioStatus.CLOSED);
        r.setFolioClosedAt(Instant.now());
        reservationRepository.save(r);

        Room room = r.getRoom();
        if (room == null) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY, "NO_ROOM_ASSIGNED", "No room assigned for checkout");
        }
        RoomStatus coPrev = room.getStatus();
        CleanlinessStatus coPrevClean = room.getCleanliness();
        room.setStatus(RoomStatus.VACANT_DIRTY);
        room.setCleanliness(CleanlinessStatus.DIRTY);
        room.setCurrentBooking(null);
        roomRepository.save(room);
        roomStatusAuditService.logTransition(
                hotelId,
                room,
                coPrev,
                RoomStatus.VACANT_DIRTY,
                coPrevClean,
                CleanlinessStatus.DIRTY,
                staff.getUsername(),
                "Guest checked out",
                staff.getId());

        housekeepingTaskService.onRoomBecameVacantDirty(hotelId, room.getId(), r.getId());

        List<RoomCharge> charges = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId());
        Invoice inv = buildInvoice(hotelId, r, charges);
        invoiceRepository.save(inv);

        notificationService.schedulePostStayEmail(r);

        eventPublisher.publishEvent(new RoomCheckedOutEvent(hotelId, room.getId(), r.getId()));

        List<ApiDtos.InvoiceLine> lines = inv.getLineItems().stream()
                .map(li -> new ApiDtos.InvoiceLine(li.getDescription(), li.getAmount()))
                .toList();

        int loyalty = inv.getTotalAmount().setScale(0, RoundingMode.DOWN).intValue();

        ApiDtos.InvoiceBreakdown breakdown = invoiceBreakdownForCheckout(r, charges);

        ApiDtos.FeedbackEcho feedbackEcho =
                b.feedback() != null ? new ApiDtos.FeedbackEcho(b.feedback().rating(), b.feedback().comment()) : null;
        ApiDtos.PostCheckoutEcho postCheckoutEcho =
                b.postCheckout() != null
                        ? new ApiDtos.PostCheckoutEcho(
                                b.postCheckout().sendInvoiceEmail(),
                                b.postCheckout().addToLoyaltyProgram(),
                                b.postCheckout().scheduleFollowUp())
                        : null;

        return new ApiDtos.CheckOutResponse(
                r.getId(),
                r.getStatus().name(),
                new ApiDtos.RoomStatusDto(
                        room.getId(), room.getRoomNumber(), room.getStatus().name(), room.getCleanliness().name()),
                new ApiDtos.InvoiceDto(
                        inv.getId(),
                        inv.getInvoiceNumber(),
                        inv.getTotalAmount(),
                        inv.getPdfUrl(),
                        lines),
                breakdown,
                feedbackEcho,
                postCheckoutEcho,
                loyalty,
                "Check-out complete. Invoice sent to "
                        + (r.getGuest().getEmail() != null ? r.getGuest().getEmail() : "guest"));
    }

    @Transactional
    public ApiDtos.NoShowResponse markNoShow(UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UserPrincipal actor = tenantAccessService.currentUser();
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (r.getStatus() != ReservationStatus.CONFIRMED) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "RESERVATION_WRONG_STATUS",
                    "Only CONFIRMED reservations can be marked no-show");
        }
        Hotel hotel = r.getHotel();
        Room rm = r.getRoom();
        BigDecimal fee =
                hotel.getNoShowDefaultFee() != null ? hotel.getNoShowDefaultFee() : new BigDecimal("50.00");
        if (rm != null && fee.compareTo(BigDecimal.ZERO) > 0) {
            RoomCharge c = new RoomCharge();
            c.setReservation(r);
            c.setRoom(rm);
            c.setDescription("No-show fee");
            c.setAmount(fee);
            c.setChargeType(ChargeType.NO_SHOW);
            c.setPostedBy(actor.getUsername());
            roomChargeRepository.save(c);
        }
        if (rm != null) {
            if (rm.getCurrentBooking() != null && rm.getCurrentBooking().getId().equals(r.getId())) {
                rm.setCurrentBooking(null);
            }
            r.setRoom(null);
            roomRepository.save(rm);
        }
        r.setStatus(ReservationStatus.NO_SHOW);
        r.setNoShowAt(Instant.now());
        reservationRepository.save(r);
        return new ApiDtos.NoShowResponse(r.getId(), r.getStatus().name(), "Marked as no-show");
    }

    private ApiDtos.InvoiceBreakdown invoiceBreakdownForCheckout(Reservation r, List<RoomCharge> charges) {
        BigDecimal roomLine = r.getTotalAmount();
        BigDecimal extras =
                charges.stream().map(RoomCharge::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sub = roomLine.add(extras);
        BigDecimal tax = sub.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal deposit = r.isDepositPaid() && r.getDepositAmount() != null ? r.getDepositAmount() : BigDecimal.ZERO;
        BigDecimal grand = sub.add(tax).subtract(deposit).setScale(2, RoundingMode.HALF_UP);
        return new ApiDtos.InvoiceBreakdown(roomLine, extras, sub, tax, deposit, grand);
    }

    @Transactional
    public ApiDtos.CancelReservationResponse cancelReservation(
            UUID hotelId, String hotelHeader, UUID reservationId, ApiDtos.CancelReservationRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (r.getStatus() == ReservationStatus.CANCELLED) {
            return new ApiDtos.CancelReservationResponse(
                    r.getId(), r.getStatus().name(), "Reservation was already cancelled");
        }
        if (r.getStatus() == ReservationStatus.NO_SHOW) {
            throw new ApiException(HttpStatus.CONFLICT, "Cannot cancel a no-show reservation");
        }
        if (r.getStatus() == ReservationStatus.CHECKED_IN) {
            throw new ApiException(HttpStatus.CONFLICT, "Cannot cancel a checked-in reservation; check out first");
        }
        if (r.getStatus() == ReservationStatus.CHECKED_OUT) {
            throw new ApiException(HttpStatus.CONFLICT, "Cannot cancel a completed stay");
        }
        if (r.getStatus() != ReservationStatus.CONFIRMED) {
            throw new ApiException(HttpStatus.CONFLICT, "Reservation cannot be cancelled in its current state");
        }
        r.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(r);
        Room room = r.getRoom();
        if (room != null) {
            if (room.getCurrentBooking() != null && room.getCurrentBooking().getId().equals(r.getId())) {
                room.setCurrentBooking(null);
            }
            RoomStatus cx = room.getStatus();
            CleanlinessStatus cc = room.getCleanliness();
            room.setStatus(RoomStatus.VACANT_CLEAN);
            roomRepository.save(room);
            roomStatusAuditService.logTransition(
                    hotelId, room, cx, RoomStatus.VACANT_CLEAN, cc, cc, auditActor(), "Reservation cancelled");
        }
        String msg = "Reservation cancelled";
        if (req != null && req.reason() != null && !req.reason().isBlank()) {
            msg = msg + " (" + req.reason().trim() + ")";
        }
        return new ApiDtos.CancelReservationResponse(r.getId(), r.getStatus().name(), msg);
    }

    private Invoice buildInvoice(UUID hotelId, Reservation r, List<RoomCharge> charges) {
        long nights = ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate());
        Invoice inv = new Invoice();
        inv.setHotel(hotelRepository.getReferenceById(hotelId));
        inv.setReservation(r);
        inv.setInvoiceNumber(nextInvoiceNumber());
        inv.setPdfUrl("https://minio.local/invoices/" + inv.getInvoiceNumber() + ".pdf");

        List<InvoiceLineItem> items = new ArrayList<>();
        int order = 0;
        BigDecimal roomLine = r.getTotalAmount();
        items.add(line(inv, order++, "Room (" + nights + " nights @ " + r.getNightlyRate() + ")", roomLine));

        BigDecimal extras = BigDecimal.ZERO;
        for (RoomCharge c : charges) {
            items.add(line(inv, order++, c.getDescription(), c.getAmount()));
            extras = extras.add(c.getAmount());
        }
        BigDecimal sub = roomLine.add(extras);
        BigDecimal tax = sub.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        items.add(line(inv, order++, "Tax (15%)", tax));

        BigDecimal deposit = r.isDepositPaid() && r.getDepositAmount() != null ? r.getDepositAmount() : BigDecimal.ZERO;
        if (deposit.signum() > 0) {
            items.add(line(inv, order++, "Deposit Paid", deposit.negate()));
        }
        BigDecimal total = sub.add(tax).subtract(deposit);
        inv.setTotalAmount(total.setScale(2, RoundingMode.HALF_UP));
        for (InvoiceLineItem li : items) {
            inv.getLineItems().add(li);
        }
        return inv;
    }

    private InvoiceLineItem line(Invoice inv, int ord, String desc, BigDecimal amt) {
        InvoiceLineItem li = new InvoiceLineItem();
        li.setInvoice(inv);
        li.setLineOrder(ord);
        li.setDescription(desc);
        li.setAmount(amt.setScale(2, RoundingMode.HALF_UP));
        return li;
    }

    private String nextInvoiceNumber() {
        int y = Year.now().getValue();
        String year = Integer.toString(y);
        int maxSuffix = invoiceRepository.findMaxInvoiceNumericSuffixForYear(year);
        return "INV-" + year + "-" + String.format("%05d", maxSuffix + 1);
    }

    @Transactional
    public GuestDtos.ApplyGuestPreferencesResponse applyGuestPreferences(
            UUID hotelId, String hotelHeader, UUID reservationId, GuestDtos.ApplyGuestPreferencesRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (r.getStatus() != ReservationStatus.CONFIRMED) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Guest preferences can only be auto-applied while reservation is CONFIRMED. Current status: "
                            + r.getStatus());
        }
        Room current = r.getRoom();
        if (current == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Reservation has no assigned room");
        }
        Guest g = r.getGuest();
        GuestDtos.ApplyPreferencesBlock flags = req != null ? req.applyPreferences() : null;
        boolean doRoom = flags == null || !Boolean.FALSE.equals(flags.roomAssignment());
        boolean doAmenities = flags == null || !Boolean.FALSE.equals(flags.amenities());
        boolean doServices = flags == null || !Boolean.FALSE.equals(flags.services());

        JsonNode prefsNode = parseGuestPreferenceNode(g, req != null ? req.overrides() : null);
        List<Map<String, Object>> alerts = buildAllergyAlerts(prefsNode);
        List<String> nextSteps = new ArrayList<>();
        Map<String, Object> applied = new HashMap<>();

        if (doRoom) {
            Integer prefFloor = extractPreferredFloor(prefsNode);
            if (prefFloor != null) {
                Optional<Room> better = findBetterFloorMatch(hotelId, r, current, prefFloor);
                if (better.isPresent()) {
                    Room newR = better.get();
                    Room oldR = current;
                    RoomStatus oldPs = oldR.getStatus();
                    CleanlinessStatus oldPc = oldR.getCleanliness();
                    RoomStatus newPs = newR.getStatus();
                    CleanlinessStatus newPc = newR.getCleanliness();
                    oldR.setStatus(RoomStatus.VACANT_CLEAN);
                    newR.setStatus(RoomStatus.RESERVED);
                    r.setRoom(newR);
                    reservationRepository.save(r);
                    roomRepository.save(oldR);
                    roomRepository.save(newR);
                    roomStatusAuditService.logTransition(
                            hotelId,
                            oldR,
                            oldPs,
                            RoomStatus.VACANT_CLEAN,
                            oldPc,
                            oldPc,
                            auditActor(),
                            "Preference-based reassignment");
                    roomStatusAuditService.logTransition(
                            hotelId,
                            newR,
                            newPs,
                            RoomStatus.RESERVED,
                            newPc,
                            newPc,
                            auditActor(),
                            "Preference-based reassignment");
                    Map<String, Object> ra = new HashMap<>();
                    ra.put("roomId", newR.getId());
                    ra.put("roomNumber", newR.getRoomNumber());
                    ra.put("matchScore", 90);
                    ra.put("matchedPreferences", List.of("preferred_floor"));
                    ra.put("unmatchedPreferences", List.of());
                    applied.put("roomAssigned", ra);
                    nextSteps.add("Room reassigned using guest floor preference");
                } else {
                    applied.put(
                            "roomAssigned",
                            Map.of("message", "No better-matching VACANT_CLEAN room for same room type and stay dates"));
                }
            } else {
                applied.put("roomAssigned", Map.of("message", "No preferredFloor in guest preferences (or overrides)"));
            }
        }

        if (doAmenities) {
            applied.put("amenitiesPrepared", List.of());
            nextSteps.add("Review manual amenity preparation for dietary and pillow preferences");
        }
        if (doServices) {
            applied.put("servicesScheduled", List.of());
        }

        if (nextSteps.isEmpty()) {
            nextSteps.add("Preferences evaluated");
        }
        return new GuestDtos.ApplyGuestPreferencesResponse(r.getId(), applied, alerts, nextSteps);
    }

    private JsonNode parseGuestPreferenceNode(Guest g, Map<String, Object> overrides) {
        ObjectNode n = objectMapper.createObjectNode();
        try {
            if (g.getPreferencesJson() != null && !g.getPreferencesJson().isBlank()) {
                JsonNode base = objectMapper.readTree(g.getPreferencesJson());
                if (base instanceof ObjectNode on) {
                    n.setAll(on);
                }
            }
            if (overrides != null) {
                for (var e : overrides.entrySet()) {
                    n.set(e.getKey(), objectMapper.valueToTree(e.getValue()));
                }
            }
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid guest preferences or overrides JSON");
        }
        return n;
    }

    private static Integer extractPreferredFloor(JsonNode n) {
        if (n == null || n.isNull()) {
            return null;
        }
        if (n.hasNonNull("preferredFloor") && n.get("preferredFloor").isNumber()) {
            return n.get("preferredFloor").asInt();
        }
        JsonNode room = n.get("room");
        if (room != null && room.hasNonNull("preferredFloor") && room.get("preferredFloor").isNumber()) {
            return room.get("preferredFloor").asInt();
        }
        return null;
    }

    private static List<Map<String, Object>> buildAllergyAlerts(JsonNode n) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (n == null) {
            return out;
        }
        JsonNode dietary = n.get("dietary");
        if (dietary == null || dietary.isNull()) {
            return out;
        }
        JsonNode allergies = dietary.get("allergies");
        if (allergies == null || !allergies.isArray() || allergies.isEmpty()) {
            return out;
        }
        List<String> items = new ArrayList<>();
        allergies.forEach(node -> items.add(node.asText()));
        Map<String, Object> alert = new HashMap<>();
        alert.put("type", "ALLERGY_ALERT");
        alert.put("message", "Guest allergies: " + String.join(", ", items) + " — notify F&B and housekeeping");
        alert.put("severity", "HIGH");
        alert.put("acknowledgedBy", null);
        out.add(alert);
        return out;
    }

    private Optional<Room> findBetterFloorMatch(UUID hotelId, Reservation r, Room current, int prefFloor) {
        int curF = current.getFloor() != null ? current.getFloor() : 0;
        int curDist = Math.abs(curF - prefFloor);
        List<Room> candidates = roomRepository.findByHotel_IdAndRoomType_Id(hotelId, current.getRoomType().getId());
        Room best = null;
        int bestDist = curDist;
        LocalDate ci = r.getCheckInDate();
        LocalDate co = r.getCheckOutDate();
        int party = r.getAdults() + (r.getChildren() != null ? r.getChildren() : 0);
        for (Room cand : candidates) {
            if (cand.getId().equals(current.getId())) {
                continue;
            }
            if (!RoomBookingEligibility.isVacantBookable(cand)) {
                continue;
            }
            if (cand.getRoomType().getMaxOccupancy() < party) {
                continue;
            }
            if (reservationRepository.countOverlapping(cand.getId(), ci, co, r.getId()) > 0) {
                continue;
            }
            if (roomBlockRepository.countActiveOverlapping(cand.getId(), ci, co) > 0) {
                continue;
            }
            int f = cand.getFloor() != null ? cand.getFloor() : 0;
            int d = Math.abs(f - prefFloor);
            if (d < bestDist) {
                bestDist = d;
                best = cand;
            }
        }
        return Optional.ofNullable(best);
    }

    @Transactional(readOnly = true)
    public GuestDtos.StaffReservationDetailResponse getStaffReservationDetail(
            UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        Guest g = r.getGuest();
        int nights = (int) ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate());
        GuestDtos.StaffGuestProfileDto guestDto = toStaffGuestProfileDto(g);
        GuestDtos.GuestAddressCard address = new GuestDtos.GuestAddressCard(
                g.getCountry(),
                g.getProvince(),
                g.getDistrict(),
                g.getSector(),
                g.getCell(),
                g.getVillage(),
                g.getStreetNumber(),
                g.getAddressNotes());
        GuestDtos.StaffReservationRoomDto roomDto = null;
        if (r.getRoom() != null) {
            Room rm = r.getRoom();
            roomDto = new GuestDtos.StaffReservationRoomDto(
                    rm.getId(),
                    rm.getRoomNumber(),
                    rm.getStatus().name(),
                    rm.getCleanliness().name());
        }
        List<GuestDtos.ReservationTimelineStep> timeline = new ArrayList<>();
        timeline.add(new GuestDtos.ReservationTimelineStep("CREATED", r.getCreatedAt()));
        timeline.add(new GuestDtos.ReservationTimelineStep("CONFIRMED", r.getCreatedAt()));
        if (r.getActualCheckIn() != null) {
            timeline.add(new GuestDtos.ReservationTimelineStep("CHECKED_IN", r.getActualCheckIn()));
        }
        if (r.getActualCheckOut() != null) {
            timeline.add(new GuestDtos.ReservationTimelineStep("CHECKED_OUT", r.getActualCheckOut()));
        }
        if (r.getNoShowAt() != null) {
            timeline.add(new GuestDtos.ReservationTimelineStep("NO_SHOW", r.getNoShowAt()));
        }
        String folioPath = "/api/v1/hotels/" + hotelId + "/reservations/" + reservationId + "/folio";
        return new GuestDtos.StaffReservationDetailResponse(
                r.getId(),
                r.getBookingReference(),
                r.getConfirmationCode(),
                r.getStatus().name(),
                r.getBookingSource(),
                r.getCheckInDate(),
                r.getCheckOutDate(),
                nights,
                guestDto,
                address,
                roomDto,
                timeline,
                folioPath);
    }

    private static GuestDtos.StaffGuestProfileDto toStaffGuestProfileDto(Guest g) {
        String displayName =
                g.getFullName() != null && !g.getFullName().isBlank()
                        ? g.getFullName().trim()
                        : g.getFirstName() + " " + g.getLastName();
        return new GuestDtos.StaffGuestProfileDto(
                g.getId(),
                displayName,
                g.getNationalId(),
                g.getDateOfBirth(),
                g.getNationality(),
                g.getGender(),
                g.getEmail(),
                g.getPhone(),
                g.getPhoneCountryCode(),
                g.getIdType(),
                g.getIdDocumentType(),
                g.getIdDocumentNumber(),
                g.getIdExpiryDate(),
                g.getVipLevel(),
                g.isBlacklisted(),
                g.getBlacklistReason(),
                g.getNotes(),
                g.isMarketingConsent());
    }

    @Transactional(readOnly = true)
    public ApiDtos.FolioResponse getFolio(UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        List<RoomCharge> charges = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(reservationId);
        List<ApiDtos.FolioCharge> fc = charges.stream()
                .map(c -> new ApiDtos.FolioCharge(
                        c.getId(),
                        c.getChargedAt(),
                        c.getDescription(),
                        c.getAmount(),
                        c.getChargeType().name(),
                        c.getQuantity(),
                        c.getPostedBy() != null ? c.getPostedBy() : "system",
                        true,
                        c.getProductSku()))
                .toList();
        List<Payment> paymentsDb = paymentRepository.findByReservation_IdOrderByProcessedAtDesc(reservationId);
        ApiDtos.FolioSummary summary =
                computeFolioSummary(r, charges, paymentsDb);
        Guest g = r.getGuest();
        ApiDtos.FolioGuestBlock guestBlock =
                new ApiDtos.FolioGuestBlock(g.getId(), g.getFirstName() + " " + g.getLastName(), g.getEmail());
        String roomNo = r.getRoom() != null ? r.getRoom().getRoomNumber() : "";
        String roomTypeName =
                r.getRoom() != null && r.getRoom().getRoomType() != null ? r.getRoom().getRoomType().getName() : "";
        int totalNights = (int) ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate());
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        int nightsElapsedOrBooked;
        if (r.getStatus() == ReservationStatus.CHECKED_OUT || r.getStatus() == ReservationStatus.CANCELLED) {
            nightsElapsedOrBooked = totalNights;
        } else if (r.getStatus() == ReservationStatus.CHECKED_IN) {
            LocalDate end = r.getCheckOutDate().isAfter(today) ? today : r.getCheckOutDate();
            if (end.isBefore(r.getCheckInDate())) {
                nightsElapsedOrBooked = 0;
            } else {
                nightsElapsedOrBooked = (int) ChronoUnit.DAYS.between(r.getCheckInDate(), end);
            }
        } else {
            nightsElapsedOrBooked = 0;
        }
        ApiDtos.FolioStayBlock stay = new ApiDtos.FolioStayBlock(
                r.getCheckInDate(), r.getCheckOutDate(), r.getStatus().name(), totalNights, nightsElapsedOrBooked);

        List<ApiDtos.FolioPaymentLine> payments = new ArrayList<>();
        if (r.isDepositPaid() && r.getDepositAmount() != null && r.getDepositAmount().signum() > 0) {
            payments.add(new ApiDtos.FolioPaymentLine(
                    null,
                    r.getCreatedAt(),
                    "card",
                    null,
                    r.getDepositAmount(),
                    "DEPOSIT",
                    "COMPLETED",
                    null,
                    "Deposit captured at reservation"));
        }
        payments.addAll(paymentsDb.stream()
                .map(p -> new ApiDtos.FolioPaymentLine(
                        p.getId(),
                        p.getProcessedAt(),
                        p.getMethod(),
                        null,
                        p.getAmount(),
                        p.getPaymentType(),
                        p.getStatus(),
                        p.getReference(),
                        p.getNotes()))
                .toList());

        List<String> actions = List.of(
                "POST /api/v1/hotels/{hotelId}/reservations/{reservationId}/charges — post consumption to this folio",
                "POST /api/v1/hotels/{hotelId}/reservations/{reservationId}/payments — record payment",
                "POST /api/v1/hotels/{hotelId}/reservations/{reservationId}/check-out — settle on departure");
        ApiDtos.FolioRealtimeHint realtime = new ApiDtos.FolioRealtimeHint(
                "ws://realtime.example/hotels/" + hotelId + "/folios/" + reservationId,
                "Illustrative channel template; wire a WebSocket client when realtime is enabled.");

        return new ApiDtos.FolioResponse(
                r.getId(),
                hotelId,
                r.getConfirmationCode(),
                r.getBookingReference(),
                guestBlock,
                stay,
                r.getRoom() != null ? r.getRoom().getId() : null,
                roomNo,
                roomTypeName,
                fc,
                payments,
                summary,
                actions,
                realtime);
    }

    private ApiDtos.FolioSummary computeFolioSummary(Reservation r, List<RoomCharge> charges, List<Payment> payments) {
        BigDecimal roomTotal = r.getTotalAmount();
        BigDecimal otherCharges =
                charges.stream().map(RoomCharge::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal gross = roomTotal.add(otherCharges);
        BigDecimal tax = gross.multiply(new BigDecimal("0.18")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal discount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal grand = gross.add(tax).subtract(discount).setScale(2, RoundingMode.HALF_UP);
        BigDecimal depositPaid = r.isDepositPaid() && r.getDepositAmount() != null ? r.getDepositAmount() : BigDecimal.ZERO;
        BigDecimal paymentRows = payments.stream()
                .filter(p -> "COMPLETED".equalsIgnoreCase(p.getStatus()))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paymentsTotal = paymentRows.add(depositPaid).setScale(2, RoundingMode.HALF_UP);
        BigDecimal balanceDue = grand.subtract(paymentsTotal).setScale(2, RoundingMode.HALF_UP);
        String currency = r.getHotel() != null ? r.getHotel().getCurrency() : "USD";
        return new ApiDtos.FolioSummary(
                r.getId(), roomTotal, otherCharges, gross, tax, discount, grand, paymentsTotal, balanceDue, currency);
    }

    @Transactional
    public ApiDtos.FolioResponse postReservationCharge(
            UUID hotelId, String hotelHeader, UUID reservationId, ApiDtos.ReservationChargePostRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (r.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ApiException(HttpStatus.CONFLICT, "Reservation must be CHECKED_IN to post charge");
        }
        ChargeType type = ChargeType.valueOf(body.chargeType().trim().toUpperCase());
        chargeService.postFolioCharge(
                hotelId,
                r,
                body.amount(),
                body.description(),
                type,
                tenantAccessService.currentUser().getUsername(),
                null);
        return getFolio(hotelId, hotelHeader, reservationId);
    }

    @Transactional
    public ApiDtos.FolioResponse addPayment(
            UUID hotelId, String hotelHeader, UUID reservationId, ApiDtos.PaymentCreateRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        Payment p = new Payment();
        p.setHotel(r.getHotel());
        p.setReservation(r);
        p.setPaymentType(body.paymentType().trim().toUpperCase());
        p.setMethod(body.method().trim().toUpperCase());
        p.setAmount(body.amount().setScale(2, RoundingMode.HALF_UP));
        p.setCurrency(body.currency().trim().toUpperCase());
        p.setReference(body.reference());
        p.setNotes(body.notes());
        p.setStatus("COMPLETED");
        p.setDeposit("DEPOSIT".equalsIgnoreCase(p.getPaymentType()));
        UserPrincipal up = tenantAccessService.currentUser();
        p.setProcessedBy(appUserRepository.findById(up.getId()).orElse(null));
        paymentRepository.save(p);
        return getFolio(hotelId, hotelHeader, reservationId);
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.FolioPaymentLine> listPayments(UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        reservationRepository
                .findByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        return paymentRepository.findByReservation_IdOrderByProcessedAtDesc(reservationId).stream()
                .map(p -> new ApiDtos.FolioPaymentLine(
                        p.getId(),
                        p.getProcessedAt(),
                        p.getMethod(),
                        null,
                        p.getAmount(),
                        p.getPaymentType(),
                        p.getStatus(),
                        p.getReference(),
                        p.getNotes()))
                .toList();
    }

    @Transactional
    public ApiDtos.FolioResponse voidPayment(
            UUID hotelId, String hotelHeader, UUID reservationId, UUID paymentId, ApiDtos.PaymentVoidRequest body) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Payment p = paymentRepository
                .findById(paymentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Payment not found"));
        if (!p.getReservation().getId().equals(reservationId) || !p.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Payment not found for reservation");
        }
        p.setStatus("VOIDED");
        p.setVoidReason(body.reason());
        p.setVoidedAt(Instant.now());
        paymentRepository.save(p);
        return getFolio(hotelId, hotelHeader, reservationId);
    }

    @Transactional(readOnly = true)
    public byte[] generateInvoicePdf(UUID hotelId, String hotelHeader, UUID reservationId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findDetailedByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
        List<RoomCharge> charges = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(reservationId);
        List<Payment> payments = paymentRepository.findByReservation_IdOrderByProcessedAtDesc(reservationId);
        ApiDtos.FolioSummary s = computeFolioSummary(r, charges, payments);
        return invoicePdfService.renderInvoicePdf(
                r,
                charges,
                payments,
                s.grossTotal(),
                s.taxTotal(),
                s.discountTotal(),
                s.grandTotal(),
                s.paymentsTotal(),
                s.balanceDue());
    }

    private void validateDates(LocalDate checkIn, LocalDate checkOut) {
        if (!checkOut.isAfter(checkIn)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "checkOutDate must be after checkInDate");
        }
    }
}
