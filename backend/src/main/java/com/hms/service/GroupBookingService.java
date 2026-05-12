package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.GroupBillingPreference;
import com.hms.entity.CorporateAccount;
import com.hms.entity.GroupBooking;
import com.hms.entity.Hotel;
import com.hms.entity.Reservation;
import com.hms.repository.CorporateAccountRepository;
import com.hms.repository.GroupBookingRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.PaymentRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomChargeRepository;
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

    @Transactional
    public GroupBooking createGroup(UUID hotelId, String hotelHeader, GroupBooking group) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        
        group.setHotel(hotel);
        if (group.getGroupCode() != null && groupBookingRepository.existsByGroupCodeIgnoreCase(group.getGroupCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "Group code already exists");
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
        if (!guestRepository.existsByIdAndHotel_Id(req.leadGuestId(), hotelId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Lead guest not found for this hotel");
        }
        LocalDate exclusiveOut =
                bookingDateNormalizer.toStorageCheckOutExclusive(req.checkInDate(), req.checkOutDate());
        if (!req.checkInDate().isBefore(exclusiveOut)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "check_out must be after check_in");
        }
        int n = req.roomCount();
        List<ApiDtos.CreateReservationResponse> created = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            ApiDtos.CreateReservationRequest body = new ApiDtos.CreateReservationRequest(
                    req.leadGuestId(),
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
        log.info("Group block reserve: groupId={} rooms={} leadGuest={}", groupId, n, req.leadGuestId());
        return new ApiDtos.GroupBlockReserveResponse(group.getId(), created.size(), created, msg);
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
}
