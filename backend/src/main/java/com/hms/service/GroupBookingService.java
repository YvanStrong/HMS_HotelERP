package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.GroupBillingPreference;
import com.hms.entity.CorporateAccount;
import com.hms.entity.GroupAllotment;
import com.hms.entity.GroupBooking;
import com.hms.entity.GroupRoomingListEntry;
import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.Reservation;
import com.hms.entity.Room;
import com.hms.entity.RoomType;
import com.hms.repository.CorporateAccountRepository;
import com.hms.repository.GroupAllotmentRepository;
import com.hms.repository.GroupBookingRepository;
import com.hms.repository.GroupRoomingListEntryRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.PaymentRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomChargeRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.security.TenantAccessService;
import com.hms.service.folio.FolioLedgerService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for handling group bookings, rooming lists, and master billing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GroupBookingService {

    private final GroupBookingRepository groupBookingRepository;
    private final HotelRepository hotelRepository;
    private final ReservationRepository reservationRepository;
    private final GuestRepository guestRepository;
    private final ReservationService reservationService;
    private final TenantAccessService tenantAccessService;
    private final BookingDateNormalizer bookingDateNormalizer;
    private final RoomChargeRepository roomChargeRepository;
    private final PaymentRepository paymentRepository;
    private final FolioLedgerService folioLedgerService;
    private final CorporateAccountRepository corporateAccountRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;
    private final GroupAllotmentRepository groupAllotmentRepository;
    private final GroupRoomingListEntryRepository groupRoomingListEntryRepository;

    @Transactional
    public GroupBooking createGroup(UUID hotelId, String hotelHeader, GroupBooking group) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));

        group.setHotel(hotel);
        if (group.getGroupCode() != null && groupBookingRepository.existsByGroupCodeIgnoreCase(group.getGroupCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "Group code already exists");
        }
        if (group.getPreferredRoomTypeId() != null
                && roomTypeRepository.findByIdAndHotel_Id(group.getPreferredRoomTypeId(), hotelId).isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Preferred room type not found for this hotel");
        }

        log.info("Creating group booking: {} for hotel {}", group.getGroupName(), hotelId);
        return groupBookingRepository.save(group);
    }

    @Transactional
    public void addReservationToGroup(UUID hotelId, UUID groupId, UUID reservationId) {
        GroupBooking group = groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        Reservation res = reservationRepository
                .findByIdAndHotel_Id(reservationId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));

        res.setGroupBooking(group);
        reservationRepository.save(res);
        log.info("Reservation {} added to group {}", reservationId, group.getGroupName());
    }

    @Transactional(readOnly = true)
    public List<GroupBooking> listGroups(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return groupBookingRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId);
    }

    @Transactional(readOnly = true)
    public List<Reservation> getRoomingList(UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (!groupBookingRepository.existsByIdAndHotel_Id(groupId, hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Group not found");
        }
        return reservationRepository.findByGroupBooking_Id(groupId);
    }

    @Transactional(readOnly = true)
    public GroupBooking getGroup(UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    /**
     * Creates {@code roomCount} separate CONFIRMED reservations, each with its own physical room, linked to the group.
     * All use the same lead guest (typical for master-bill or coordinator-led blocks). Entire operation is one
     * transaction — if the Nth room cannot be assigned, everything rolls back.
     */
    @Transactional
    public ApiDtos.GroupBlockReserveResponse reserveBlock(
            UUID hotelId, String hotelHeader, UUID groupId, ApiDtos.GroupBlockReserveRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GroupBooking group = groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        UUID leadGuestId = resolveLeadGuestId(hotelId, req.leadGuestId(), group);
        LocalDate exclusiveOut =
                bookingDateNormalizer.toStorageCheckOutExclusive(req.checkInDate(), req.checkOutDate());
        if (!req.checkInDate().isBefore(exclusiveOut)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "check_out must be after check_in");
        }
        int n = req.roomCount();
        List<ApiDtos.CreateReservationResponse> created = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            ApiDtos.CreateReservationRequest body = new ApiDtos.CreateReservationRequest(
                    leadGuestId,
                    null,
                    req.roomTypeId(),
                    null,
                    null,
                    req.checkInDate(),
                    req.checkOutDate(),
                    req.adultsPerRoom(),
                    0,
                    "Group \"" + group.getGroupName() + "\" — room " + i + " of " + n,
                    "GROUP_BLOCK",
                    null,
                    null,
                    group.getId());
            created.add(reservationService.createReservation(hotelId, hotelHeader, body));
        }
        String msg = "Created "
                + n
                + " confirmed reservation(s) linked to group \""
                + group.getGroupName()
                + "\". Each has its own room key path on the reservation screen.";
        log.info("Group block reserve: groupId={} rooms={} leadGuest={}", groupId, n, leadGuestId);
        return new ApiDtos.GroupBlockReserveResponse(group.getId(), created.size(), created, msg);
    }

    /**
     * Uses the explicit lead guest when provided; otherwise finds or creates a deterministic placeholder guest
     * keyed by group id so repeat block bookings stay on one profile.
     */
    private UUID resolveLeadGuestId(UUID hotelId, UUID requestedLeadGuestId, GroupBooking group) {
        if (requestedLeadGuestId != null) {
            if (!guestRepository.existsByIdAndHotel_Id(requestedLeadGuestId, hotelId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Lead guest not found for this hotel");
            }
            return requestedLeadGuestId;
        }
        return getOrCreateGroupBlockPlaceholderGuest(hotelId, group);
    }

    private UUID getOrCreateGroupBlockPlaceholderGuest(UUID hotelId, GroupBooking group) {
        String rawNationalId = "GRP-" + group.getId().toString().replace("-", "");
        final String nationalId =
                rawNationalId.length() > 50 ? rawNationalId.substring(0, 50) : rawNationalId;
        return guestRepository
                .findByHotel_IdAndNationalIdIgnoreCase(hotelId, nationalId)
                .map(Guest::getId)
                .orElseGet(() -> {
                    Hotel hotel = hotelRepository
                            .findById(hotelId)
                            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
                    Guest g = new Guest();
                    g.setHotel(hotel);
                    String contact = group.getContactPerson() != null ? group.getContactPerson().trim() : "";
                    String fullName;
                    String firstName;
                    String lastName;
                    if (!contact.isEmpty()) {
                        fullName = contact;
                        String[] parts = contact.split("\\s+", 2);
                        firstName = parts[0];
                        lastName = parts.length > 1 ? parts[1] : "Contact";
                    } else if (group.getCompanyName() != null && !group.getCompanyName().isBlank()) {
                        fullName = group.getCompanyName().trim() + " — group contact";
                        firstName = "Group";
                        lastName = group.getCompanyName().trim();
                        if (lastName.length() > 120) {
                            lastName = lastName.substring(0, 120);
                        }
                    } else {
                        fullName = group.getGroupName().trim() + " — coordinator";
                        firstName = "Group";
                        lastName = "Coordinator";
                    }
                    g.setFirstName(firstName);
                    g.setLastName(lastName);
                    g.setFullName(fullName.length() > 200 ? fullName.substring(0, 200) : fullName);
                    g.setNationalId(nationalId);
                    g.setDateOfBirth(LocalDate.of(1990, 1, 1));
                    if (group.getContactEmail() != null && !group.getContactEmail().isBlank()) {
                        g.setEmail(group.getContactEmail().trim());
                    }
                    if (group.getContactPhone() != null && !group.getContactPhone().isBlank()) {
                        g.setPhone(group.getContactPhone().trim());
                    }
                    g.setNotes(
                            "Auto-created placeholder lead guest for group block reservations. Group id: "
                                    + group.getId());
                    g.setGuestType("RETURNING");
                    g.setMarketingConsent(false);
                    GuestProfileDefaults.ensureRequiredForPersistence(g, hotel);
                    guestRepository.save(g);
                    log.info("Created group block placeholder guest id={} for groupId={}", g.getId(), group.getId());
                    return g.getId();
                });
    }

    @Transactional
    public void patchBilling(UUID hotelId, String hotelHeader, UUID groupId, ApiDtos.GroupBillingPatchRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GroupBooking g = groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        if (Boolean.TRUE.equals(req.clearMasterReservation())) {
            g.setMasterReservation(null);
        } else if (req.masterReservationId() != null) {
            Reservation master = reservationRepository
                    .findByIdAndHotel_IdWithGroupBilling(req.masterReservationId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Master reservation not found"));
            GroupBooking linked = master.getGroupBooking();
            if (linked == null || !linked.getId().equals(groupId)) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST, "Master reservation must belong to this group (link it first).");
            }
            g.setMasterReservation(master);
        }
        if (Boolean.TRUE.equals(req.clearCorporateAccount())) {
            g.setCorporateAccount(null);
        } else if (req.corporateAccountId() != null) {
            CorporateAccount ca = corporateAccountRepository
                    .findByIdAndHotel_Id(req.corporateAccountId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Corporate account not found"));
            g.setCorporateAccount(ca);
        }
        if (req.billingPreference() != null) {
            String raw = req.billingPreference().trim();
            if (raw.isEmpty()) {
                g.setBillingPreference(null);
            } else {
                GroupBillingPreference p = GroupBillingPreference.parse(raw);
                if (p == null) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid billing_preference");
                }
                g.setBillingPreference(p.name());
            }
        }
        groupBookingRepository.save(g);
        log.info("Updated group billing: groupId={} hotelId={}", groupId, hotelId);
    }

    @Transactional(readOnly = true)
    public ApiDtos.GroupBillingDashboardResponse getBillingDashboard(
            UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GroupBooking g = groupBookingRepository
                .findWithBillingRelations(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        ApiDtos.GroupBillingDashboardCorporate corp = null;
        if (g.getCorporateAccount() != null) {
            CorporateAccount ca = g.getCorporateAccount();
            corp = new ApiDtos.GroupBillingDashboardCorporate(
                    ca.getId(),
                    ca.getCompanyName(),
                    ca.getBillingEmail(),
                    ca.getCreditLimit() != null ? ca.getCreditLimit() : BigDecimal.ZERO,
                    ca.getPaymentTerms(),
                    ca.getStatus());
        }
        ApiDtos.GroupBillingDashboardMasterFolio masterFolio = null;
        if (g.getMasterReservation() != null) {
            Reservation m = g.getMasterReservation();
            var ch = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(m.getId());
            var pay = paymentRepository.findByReservation_IdOrderByProcessedAtDesc(m.getId());
            var sum = folioLedgerService.toSummary(m, ch, pay);
            var mg = m.getGuest();
            masterFolio = new ApiDtos.GroupBillingDashboardMasterFolio(
                    m.getId(),
                    m.getConfirmationCode(),
                    mg.getFirstName() + " " + mg.getLastName(),
                    sum.balanceDue(),
                    m.getHotel().getCurrency());
        }
        List<Reservation> members = reservationRepository.findByGroupBooking_Id(groupId);
        List<ApiDtos.GroupBillingDashboardMember> rows = new ArrayList<>();
        for (Reservation mem : members) {
            var ch = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(mem.getId());
            var pay = paymentRepository.findByReservation_IdOrderByProcessedAtDesc(mem.getId());
            var sum = folioLedgerService.toSummary(mem, ch, pay);
            var guest = mem.getGuest();
            boolean isMaster = g.getMasterReservation() != null && mem.getId().equals(g.getMasterReservation().getId());
            rows.add(
                    new ApiDtos.GroupBillingDashboardMember(
                            mem.getId(),
                            mem.getConfirmationCode(),
                            guest.getFirstName() + " " + guest.getLastName(),
                            mem.getRoom() != null ? mem.getRoom().getRoomNumber() : "",
                            mem.getStatus().name(),
                            sum.balanceDue(),
                            isMaster));
        }
        rows.sort(Comparator.comparing(ApiDtos.GroupBillingDashboardMember::roomNumber));
        return new ApiDtos.GroupBillingDashboardResponse(
                g.getId(),
                g.getGroupName(),
                g.getGroupCode(),
                g.getBillingPreference(),
                corp,
                masterFolio,
                rows);
    }

    @Transactional
    public ApiDtos.GroupPickupDashboardResponse upsertAllotments(
            UUID hotelId, String hotelHeader, UUID groupId, ApiDtos.GroupAllotmentUpsertRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GroupBooking group = groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        Hotel hotel = group.getHotel();
        RoomType roomType = roomTypeRepository
                .findByIdAndHotel_Id(req.roomTypeId(), hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room type not found"));
        LocalDate day = req.fromDate();
        if (!day.isBefore(req.toDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "toDate must be after fromDate");
        }
        List<GroupAllotment> existingAllotments =
                groupAllotmentRepository.findByGroupBooking_IdOrderByAllotmentDateAsc(groupId);
        while (day.isBefore(req.toDate())) {
            GroupAllotment allotment = null;
            for (GroupAllotment candidate : existingAllotments) {
                if (candidate.getRoomType() != null
                        && candidate.getRoomType().getId().equals(roomType.getId())
                        && candidate.getAllotmentDate().equals(day)) {
                    allotment = candidate;
                    break;
                }
            }
            if (allotment == null) {
                allotment = new GroupAllotment();
            }
            if (allotment.getId() == null) {
                allotment.setHotel(hotel);
                allotment.setGroupBooking(group);
                allotment.setRoomType(roomType);
                allotment.setAllotmentDate(day);
            }
            allotment.setContractedRooms(req.contractedRooms());
            allotment.setRateAmount(req.rateAmount());
            allotment.setReleaseDate(req.releaseDate());
            allotment.setStatus("ACTIVE");
            groupAllotmentRepository.save(allotment);
            day = day.plusDays(1);
        }
        return getPickupDashboard(hotelId, hotelHeader, groupId);
    }

    @Transactional(readOnly = true)
    public ApiDtos.GroupPickupDashboardResponse getPickupDashboard(UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GroupBooking group = groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        List<GroupAllotment> allotments = groupAllotmentRepository.findByGroupBooking_IdOrderByAllotmentDateAsc(groupId);
        int contracted = 0;
        int picked = 0;
        int released = 0;
        int washed = 0;
        List<ApiDtos.GroupAllotmentRow> rows = new ArrayList<>();
        for (GroupAllotment a : allotments) {
            int pickedForDay = reservationRepository.findByGroupBooking_Id(groupId).stream()
                    .filter(r -> r.getRoom() != null
                            && a.getRoomType() != null
                            && r.getRoom().getRoomType().getId().equals(a.getRoomType().getId())
                            && !r.getCheckInDate().isAfter(a.getAllotmentDate())
                            && r.getCheckOutDate().isAfter(a.getAllotmentDate()))
                    .toList()
                    .size();
            a.setPickedUpRooms(pickedForDay);
            contracted += a.getContractedRooms();
            picked += pickedForDay;
            released += a.getReleasedRooms();
            washed += a.getWashedRooms();
            rows.add(toAllotmentRow(a));
        }
        int remaining = Math.max(0, contracted - picked - released - washed);
        BigDecimal pickupPct = contracted > 0
                ? BigDecimal.valueOf(picked * 100.0 / contracted).setScale(2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return new ApiDtos.GroupPickupDashboardResponse(
                group.getId(), group.getGroupName(), contracted, picked, remaining, released, washed, pickupPct, rows);
    }

    @Transactional
    public List<ApiDtos.GroupRoomingListEntryRow> addRoomingListEntry(
            UUID hotelId, String hotelHeader, UUID groupId, ApiDtos.GroupRoomingListEntryRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GroupBooking group = groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        GroupRoomingListEntry entry = new GroupRoomingListEntry();
        entry.setHotel(group.getHotel());
        entry.setGroupBooking(group);
        entry.setGuestName(req.guestName().trim());
        entry.setGuestEmail(req.guestEmail());
        entry.setGuestPhone(req.guestPhone());
        entry.setCheckInDate(req.checkInDate());
        entry.setCheckOutDate(bookingDateNormalizer.toStorageCheckOutExclusive(req.checkInDate(), req.checkOutDate()));
        if (!entry.getCheckInDate().isBefore(entry.getCheckOutDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "checkOutDate must be after checkInDate");
        }
        if (req.roomTypeId() != null) {
            entry.setRoomType(roomTypeRepository
                    .findByIdAndHotel_Id(req.roomTypeId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room type not found")));
        }
        if (req.roomId() != null) {
            entry.setRoom(roomRepository
                    .findByIdAndHotel_Id(req.roomId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Room not found")));
        }
        entry.setAdults(req.adults() != null ? req.adults() : 1);
        entry.setChildren(req.children() != null ? req.children() : 0);
        entry.setPaymentResponsibility(req.paymentResponsibility());
        entry.setSharingKey(req.sharingKey());
        entry.setStatus(req.status() != null && !req.status().isBlank() ? req.status().trim().toUpperCase() : "DRAFT");
        groupRoomingListEntryRepository.save(entry);
        return listRoomingListEntries(hotelId, hotelHeader, groupId);
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.GroupRoomingListEntryRow> listRoomingListEntries(UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (!groupBookingRepository.existsByIdAndHotel_Id(groupId, hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Group not found");
        }
        return groupRoomingListEntryRepository.findByGroupBooking_IdOrderByCheckInDateAscGuestNameAsc(groupId)
                .stream()
                .map(this::toRoomingRow)
                .toList();
    }

    private ApiDtos.GroupAllotmentRow toAllotmentRow(GroupAllotment a) {
        RoomType rt = a.getRoomType();
        return new ApiDtos.GroupAllotmentRow(
                a.getId(),
                rt != null ? rt.getId() : null,
                rt != null ? rt.getName() : null,
                a.getAllotmentDate(),
                a.getContractedRooms(),
                a.getPickedUpRooms(),
                a.getReleasedRooms(),
                a.getWashedRooms(),
                a.getRateAmount(),
                a.getReleaseDate(),
                a.getStatus());
    }

    private ApiDtos.GroupRoomingListEntryRow toRoomingRow(GroupRoomingListEntry e) {
        RoomType rt = e.getRoomType();
        Room room = e.getRoom();
        Guest guest = e.getGuest();
        Reservation reservation = e.getReservation();
        return new ApiDtos.GroupRoomingListEntryRow(
                e.getId(),
                reservation != null ? reservation.getId() : null,
                guest != null ? guest.getId() : null,
                e.getGuestName(),
                e.getGuestEmail(),
                e.getGuestPhone(),
                e.getCheckInDate(),
                e.getCheckOutDate(),
                rt != null ? rt.getId() : null,
                rt != null ? rt.getName() : null,
                room != null ? room.getId() : null,
                room != null ? room.getRoomNumber() : null,
                e.getAdults(),
                e.getChildren(),
                e.getPaymentResponsibility(),
                e.getSharingKey(),
                e.getStatus(),
                e.getValidationErrors());
    }

    /**
     * Removes a group booking row when it has no linked reservations. Reservations keep their folios; only the
     * grouping row is removed.
     */
    @Transactional
    public void deleteGroup(UUID hotelId, String hotelHeader, UUID groupId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        GroupBooking g = groupBookingRepository
                .findByIdAndHotel_Id(groupId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
        long linked = reservationRepository.countByGroupBooking_Id(groupId);
        if (linked > 0) {
            String detail =
                    linked == 1
                            ? "This group still has 1 reservation on the books. Cancel or check out that stay first "
                                    + "(from Reservations), then you can delete the group."
                            : "This group still has "
                                    + linked
                                    + " reservations on the books. Cancel or check out those stays first "
                                    + "(from Reservations), then you can delete the group.";
            throw new ApiException(HttpStatus.CONFLICT, "GROUP_HAS_RESERVATIONS", detail);
        }
        g.setMasterReservation(null);
        g.setCorporateAccount(null);
        groupBookingRepository.save(g);
        groupBookingRepository.delete(g);
        log.info("Deleted group booking id={} hotelId={}", groupId, hotelId);
    }
}
