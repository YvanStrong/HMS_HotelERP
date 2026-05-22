package com.hms.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.GuestDtos;
import com.hms.domain.LoyaltyTier;
import com.hms.domain.LoyaltyTxnStatus;
import com.hms.domain.LoyaltyTxnType;
import com.hms.domain.RedemptionType;
import com.hms.domain.ReservationStatus;
import com.hms.domain.Role;
import com.hms.entity.Guest;
import com.hms.entity.GuestComplaint;
import com.hms.entity.GuestFeedback;
import com.hms.entity.GuestCommunication;
import com.hms.entity.GuestDocument;
import com.hms.entity.Hotel;
import com.hms.entity.LoyaltyTransaction;
import com.hms.entity.Reservation;
import com.hms.entity.SensitiveIncident;
import com.hms.repository.AppUserRepository;
import com.hms.repository.GuestComplaintRepository;
import com.hms.repository.GuestCommunicationRepository;
import com.hms.repository.GuestDocumentRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.LoyaltyTransactionRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.SensitiveIncidentRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.service.folio.FolioLedgerService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GuestService {

    private static final long SILVER_AT = 1000L;
    private static final long GOLD_AT = 3000L;
    private static final long PLATINUM_AT = 8000L;

    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final TenantAccessService tenantAccessService;
    private final ObjectMapper objectMapper;
    private final HotelRepository hotelRepository;
    private final AppUserRepository appUserRepository;
    private final com.hms.repository.GuestFeedbackRepository guestFeedbackRepository;
    private final GuestDocumentRepository guestDocumentRepository;
    private final GuestCommunicationRepository guestCommunicationRepository;
    private final SensitiveIncidentRepository sensitiveIncidentRepository;
    private final FolioLedgerService folioLedgerService;
    private final GuestComplaintRepository guestComplaintRepository;

    public GuestService(
            GuestRepository guestRepository,
            ReservationRepository reservationRepository,
            LoyaltyTransactionRepository loyaltyTransactionRepository,
            TenantAccessService tenantAccessService,
            ObjectMapper objectMapper,
            HotelRepository hotelRepository,
            AppUserRepository appUserRepository,
            com.hms.repository.GuestFeedbackRepository guestFeedbackRepository,
            GuestDocumentRepository guestDocumentRepository,
            GuestCommunicationRepository guestCommunicationRepository,
            SensitiveIncidentRepository sensitiveIncidentRepository,
            FolioLedgerService folioLedgerService,
            GuestComplaintRepository guestComplaintRepository) {
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.loyaltyTransactionRepository = loyaltyTransactionRepository;
        this.tenantAccessService = tenantAccessService;
        this.objectMapper = objectMapper;
        this.hotelRepository = hotelRepository;
        this.appUserRepository = appUserRepository;
        this.guestFeedbackRepository = guestFeedbackRepository;
        this.guestDocumentRepository = guestDocumentRepository;
        this.guestCommunicationRepository = guestCommunicationRepository;
        this.sensitiveIncidentRepository = sensitiveIncidentRepository;
        this.folioLedgerService = folioLedgerService;
        this.guestComplaintRepository = guestComplaintRepository;
    }

    @Transactional(readOnly = true)
    public List<GuestDtos.GuestSearchHit> searchGuests(UUID hotelId, String hotelHeader, String q) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return guestRepository.searchGuestsForHotel(hotelId, q.trim()).stream()
                .limit(30)
                .map(GuestService::toSearchHit)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GuestDtos.GuestSearchHit> listGuests(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return guestRepository.findByHotel_Id(hotelId).stream()
                .map(GuestService::toSearchHit)
                .toList();
    }

    @Transactional
    public GuestDtos.GuestSearchHit createGuestForStaff(
            UUID hotelId, String hotelHeader, ApiDtos.GuestInput input) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (input.nationalId() == null || input.nationalId().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "national_id is required");
        }
        if (input.dateOfBirth() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "date_of_birth is required");
        }
        guestRepository
                .findByHotel_IdAndNationalIdIgnoreCase(hotelId, input.nationalId().trim())
                .ifPresent(
                        x -> {
                            throw new ApiException(
                                    HttpStatus.CONFLICT,
                                    "GUEST_NATIONAL_ID_EXISTS",
                                    "A guest with this national ID already exists for this hotel");
                        });
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        Guest guest = new Guest();
        GuestInputApplier.populateNewGuest(hotel, guest, input);
        UserPrincipal actor = tenantAccessService.currentUser();
        guest.setCreatedBy(appUserRepository.getReferenceById(actor.getId()));
        guestRepository.save(guest);
        return toSearchHit(guest);
    }

    private static GuestDtos.GuestSearchHit toSearchHit(Guest g) {
        String displayName =
                g.getFullName() != null && !g.getFullName().isBlank()
                        ? g.getFullName().trim()
                        : g.getFirstName() + " " + g.getLastName();
        GuestDtos.StaffGuestProfileDto profile = new GuestDtos.StaffGuestProfileDto(
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
                g.isMarketingConsent(),
                g.getGuestType() != null ? g.getGuestType() : "RETURNING",
                g.getLoyaltyMemberNumber());
        GuestDtos.GuestAddressCard address = new GuestDtos.GuestAddressCard(
                g.getCountry(),
                g.getProvince(),
                g.getDistrict(),
                g.getSector(),
                g.getCell(),
                g.getVillage(),
                g.getStreetNumber(),
                g.getAddressNotes());
        return new GuestDtos.GuestSearchHit(profile, address);
    }

    @Transactional(readOnly = true)
    public GuestDtos.GuestProfileResponse profile(UUID hotelId, String hotelHeader, UUID guestId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Guest g = guestRepository
                .findByIdAndHotel_Id(guestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Guest not found"));
        long stays = guestRepository.countReservationsByGuest(guestId, hotelId);
        BigDecimal ltv = guestRepository.sumLifetimeSpendByGuest(guestId, hotelId);
        long nights = guestRepository.sumNightsByGuest(guestId, hotelId);

        Map<String, Object> loyalty = loyaltyBlock(g);
        Map<String, Object> prefs = parseJsonMap(g.getPreferencesJson());
        Map<String, Object> stay = new HashMap<>();
        stay.put("totalStays", stays);
        stay.put("totalNights", nights);
        stay.put("lifetimeValue", ltv);
        stay.put("lastStay", lastStayMap(hotelId, guestId));
        stay.put("outstandingBalance", folioLedgerService.computeBalanceDue(hotelId, guestId));
        stay.put("outstandingBalanceCurrency", g.getHotel().getCurrency());
        stay.put("documentCompliance", documentComplianceBlock(guestId));

        Map<String, Object> comm = new HashMap<>();
        comm.put("emailOptIn", g.isEmailOptIn());
        comm.put("smsOptIn", g.isSmsOptIn());
        comm.put("preferredLanguage", g.getPreferredLanguage());
        comm.put("doNotContactUntil", null);

        boolean vip = g.getLoyaltyTier() == LoyaltyTier.PLATINUM
                || ltv.compareTo(new BigDecimal("10000")) > 0
                || "VIP".equalsIgnoreCase(g.getVipLevel());
        
        List<com.hms.entity.GuestFeedback> feedback = guestFeedbackRepository.findByGuest_IdOrderBySubmittedAtDesc(guestId);
        Map<String, Object> feedbackBlock = new HashMap<>();
        feedbackBlock.put(
                "history",
                feedback.stream()
                        .map(f -> {
                            Map<String, Object> row = new HashMap<>();
                            row.put("rating", f.getRating());
                            row.put("category", f.getCategory() != null ? f.getCategory() : "");
                            row.put("comment", f.getComment() != null ? f.getComment() : "");
                            row.put("date", f.getSubmittedAt());
                            row.put("resolved", f.isResolved());
                            row.put("resolutionNotes", f.getResolutionNotes() != null ? f.getResolutionNotes() : "");
                            return row;
                        })
                        .toList());
        feedbackBlock.put(
                "averageRating",
                feedback.stream()
                        .mapToInt(f -> f.getRating() != null ? f.getRating() : 0)
                        .average()
                        .orElse(0.0));

        Map<String, Object> flags = new HashMap<>();
        flags.put("isVIP", vip);
        long openOpsComplaints =
                guestComplaintRepository.countByGuest_IdAndHotel_IdAndStatusIn(
                        guestId, hotelId, GuestComplaintService.OPEN_WORKFLOW_STATUSES);
        flags.put(
                "requiresSpecialAttention",
                !guestFeedbackRepository.findByGuest_IdAndResolvedFalse(guestId).isEmpty()
                        || openOpsComplaints > 0);
        flags.put("open_operational_complaints", openOpsComplaints);
        flags.put("blacklisted", g.isBlacklisted());
        flags.put("blacklistReason", g.getBlacklistReason());
        flags.put("returningGuest", stays > 1);

        String name = g.getFirstName() + " " + g.getLastName();
        Map<String, Object> registry = buildRegistry(hotelId, guestId, g);
        List<GuestComplaint> opCases =
                guestComplaintRepository.findByHotel_IdAndGuest_IdOrderByOpenedAtDesc(hotelId, guestId);
        Map<String, Object> operationalComplaints = new HashMap<>();
        operationalComplaints.put(
                "cases",
                opCases.stream().map(cx -> toOperationalComplaintMap(cx)).toList());
        operationalComplaints.put("open_count", openOpsComplaints);
        return new GuestDtos.GuestProfileResponse(
                g.getId(),
                name,
                g.getEmail(),
                loyalty,
                prefs,
                stay,
                comm,
                flags,
                feedbackBlock,
                operationalComplaints,
                registry);
    }

    private static Map<String, Object> toOperationalComplaintMap(GuestComplaint cx) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", cx.getId().toString());
        m.put("type", cx.getType());
        m.put("severity", cx.getSeverity().name());
        m.put("status", cx.getStatus().name());
        m.put("description", cx.getDescription());
        m.put("resolution", cx.getResolution());
        m.put("opened_at", cx.getOpenedAt());
        m.put("resolved_at", cx.getResolvedAt());
        m.put("reservation_id", cx.getReservation().getId().toString());
        if (cx.getAssignedTo() != null) {
            m.put("assigned_to", cx.getAssignedTo().getId().toString());
            m.put("assigned_to_name", cx.getAssignedTo().getUsername());
        } else {
            m.put("assigned_to", null);
            m.put("assigned_to_name", null);
        }
        return m;
    }

    @Transactional
    public GuestDtos.LoyaltyEarnResponse earnLoyalty(UUID hotelId, String hotelHeader, UUID guestId, GuestDtos.LoyaltyEarnRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Guest g = guestRepository
                .findByIdAndHotel_Id(guestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Guest not found"));
        if (req.points() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "points must be positive");
        }
        LoyaltyTxnType type =
                req.type() != null && !req.type().isBlank()
                        ? LoyaltyTxnType.valueOf(req.type().trim().toUpperCase())
                        : LoyaltyTxnType.EARNED;
        long prev = currentPostedLoyaltyPoints(g.getId());
        long next = prev + req.points();
        g.setLoyaltyPoints(next);
        g.setLoyaltyTier(tierFromPoints(next));
        guestRepository.save(g);

        LoyaltyTransaction tx = new LoyaltyTransaction();
        tx.setGuest(g);
        tx.setType(type);
        tx.setPoints(req.points());
        if (req.reference() != null) {
            tx.setReference(req.reference().type() + ":" + req.reference().id());
        }
        tx.setDescription(req.description());
        if (req.expiryDate() != null) {
            tx.setExpiryDate(req.expiryDate().atStartOfDay(ZoneOffset.UTC).toInstant());
        }
        tx.setStatus(LoyaltyTxnStatus.POSTED);
        tx = loyaltyTransactionRepository.save(tx);

        Map<String, Object> guestMap = new HashMap<>();
        guestMap.put("id", g.getId().toString());
        guestMap.put("previousPoints", prev);
        guestMap.put("pointsEarned", req.points());
        guestMap.put("newPoints", next);
        guestMap.put("tier", g.getLoyaltyTier().name());
        guestMap.put("progressToNextTier", progressToNextTier(next));

        Map<String, Object> txnMap = new HashMap<>();
        txnMap.put("description", req.description());
        txnMap.put("expiryDate", req.expiryDate());
        txnMap.put("status", tx.getStatus().name());

        Map<String, Object> notif = new HashMap<>();
        notif.put("sent", Boolean.TRUE.equals(req.notifyGuest()));
        notif.put("method", "email");
        notif.put("template", "loyalty_points_earned");
        notif.put("scheduledSend", Instant.now().toString());

        return new GuestDtos.LoyaltyEarnResponse(tx.getId(), guestMap, txnMap, notif);
    }

    @Transactional
    public void internalEarnLoyalty(UUID guestId, long points, String description, String refType, String refId) {
        Guest g = guestRepository.findById(guestId).orElse(null);
        if (g == null || points <= 0) return;

        long prev = currentPostedLoyaltyPoints(g.getId());
        long next = prev + points;
        g.setLoyaltyPoints(next);
        g.setLoyaltyTier(tierFromPoints(next));
        guestRepository.save(g);

        LoyaltyTransaction tx = new LoyaltyTransaction();
        tx.setGuest(g);
        tx.setType(LoyaltyTxnType.EARNED);
        tx.setPoints(points);
        tx.setReference(refType + ":" + refId);
        tx.setDescription(description);
        tx.setStatus(LoyaltyTxnStatus.POSTED);
        loyaltyTransactionRepository.save(tx);
        log.info("Internally awarded {} points to guest {} for {}", points, guestId, description);
    }

    @Transactional
    public GuestDtos.LoyaltyRedeemResponse redeemLoyalty(
            UUID hotelId, String hotelHeader, UUID guestId, GuestDtos.LoyaltyRedeemRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Guest g = guestRepository
                .findByIdAndHotel_Id(guestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Guest not found"));
        if (!Boolean.TRUE.equals(req.guestConfirmation())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "guestConfirmation is required");
        }
        if (req.pointsToRedeem() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "pointsToRedeem must be positive");
        }
        long prev = currentPostedLoyaltyPoints(g.getId());
        g.setLoyaltyPoints(prev);
        g.setLoyaltyTier(tierFromPoints(prev));
        if (prev < req.pointsToRedeem()) {
            throw new ApiException(HttpStatus.CONFLICT, "Insufficient loyalty points");
        }
        RedemptionType rtype = RedemptionType.valueOf(req.redemptionType().trim().toUpperCase());
        long next = prev - req.pointsToRedeem();
        g.setLoyaltyPoints(next);
        g.setLoyaltyTier(tierFromPoints(next));
        guestRepository.save(g);

        LoyaltyTransaction tx = new LoyaltyTransaction();
        tx.setGuest(g);
        tx.setType(LoyaltyTxnType.REDEEMED);
        tx.setPoints(-req.pointsToRedeem());
        if (req.reference() != null) {
            tx.setReference(req.reference().type() + ":" + req.reference().id());
        }
        tx.setDescription("Redemption: " + rtype);
        tx.setRedemptionType(rtype);
        tx.setRedemptionValue(BigDecimal.ZERO);
        tx.setStatus(LoyaltyTxnStatus.POSTED);
        tx = loyaltyTransactionRepository.save(tx);

        Map<String, Object> guestMap = Map.of(
                "previousPoints", prev,
                "newPoints", next,
                "tier", g.getLoyaltyTier().name());

        Map<String, Object> benefit = new HashMap<>();
        benefit.put("type", rtype.name());
        benefit.put("description", "Points redeemed (" + rtype + ")");
        benefit.put("monetaryValue", BigDecimal.ZERO);
        benefit.put("appliedTo", req.reference() != null ? req.reference() : Map.of());

        List<String> notes = new ArrayList<>();
        notes.add("Loyalty ledger updated");
        if (rtype == RedemptionType.ROOM_UPGRADE) {
            notes.add("Room upgrade benefit recorded; assign upgraded room in reservation module if needed");
        }

        return new GuestDtos.LoyaltyRedeemResponse(
                tx.getId(), req.pointsToRedeem(), guestMap, benefit, false, notes);
    }

    private Map<String, Object> loyaltyBlock(Guest g) {
        Map<String, Object> m = new HashMap<>();
        long p = currentPostedLoyaltyPoints(g.getId());
        LoyaltyTier tier = tierFromPoints(p);
        m.put("tier", tier.name());
        m.put("points", p);
        m.put("source", "posted_loyalty_transactions");
        m.put("calculation", "Automatic from checked-out stay invoices, staff-posted ledger rows, and redemptions");
        if (p < SILVER_AT) {
            m.put("nextTier", "SILVER");
            m.put("pointsToNextTier", SILVER_AT - p);
        } else if (p < GOLD_AT) {
            m.put("nextTier", "GOLD");
            m.put("pointsToNextTier", GOLD_AT - p);
        } else if (p < PLATINUM_AT) {
            m.put("nextTier", "PLATINUM");
            m.put("pointsToNextTier", PLATINUM_AT - p);
        } else {
            m.put("nextTier", null);
            m.put("pointsToNextTier", 0L);
        }
        m.put("tierBenefits", List.of("late_checkout", "welcome_amenity"));
        return m;
    }

    private long currentPostedLoyaltyPoints(UUID guestId) {
        return Math.max(0L, loyaltyTransactionRepository.sumPostedPointsByGuestId(guestId));
    }

    private static String progressToNextTier(long points) {
        if (points >= PLATINUM_AT) {
            return "100%";
        }
        long next = points < SILVER_AT ? SILVER_AT : points < GOLD_AT ? GOLD_AT : PLATINUM_AT;
        long prev = points < SILVER_AT ? 0 : points < GOLD_AT ? SILVER_AT : GOLD_AT;
        int pct = (int) Math.min(100, Math.max(0, (points - prev) * 100 / Math.max(1, next - prev)));
        return pct + "%";
    }

    private static LoyaltyTier tierFromPoints(long p) {
        if (p >= PLATINUM_AT) {
            return LoyaltyTier.PLATINUM;
        }
        if (p >= GOLD_AT) {
            return LoyaltyTier.GOLD;
        }
        if (p >= SILVER_AT) {
            return LoyaltyTier.SILVER;
        }
        return LoyaltyTier.BRONZE;
    }

    private Map<String, Object> lastStayMap(UUID hotelId, UUID guestId) {
        return reservationRepository
                .findFirstByGuest_IdAndHotel_IdOrderByCheckInDateDesc(guestId, hotelId)
                .map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("date", r.getCheckInDate().toString());
                    m.put("hotel", r.getHotel().getName());
                    m.put("roomType", r.getRoom() != null ? r.getRoom().getRoomType().getName() : "");
                    m.put("rating", null);
                    return m;
                })
                .orElse(Map.of());
    }

    @Transactional
    public void mergeGuests(UUID hotelId, UUID sourceGuestId, UUID targetGuestId) {
        tenantAccessService.assertHotelAccess(hotelId, null);
        Guest source = guestRepository.findByIdAndHotel_Id(sourceGuestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Source guest not found"));
        Guest target = guestRepository.findByIdAndHotel_Id(targetGuestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Target guest not found"));

        if (source.getId().equals(target.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Source and target guest are the same");
        }

        // 1. Move reservations
        reservationRepository.findByGuest_Id(sourceGuestId).forEach(r -> {
            r.setGuest(target);
            reservationRepository.save(r);
        });

        // 2. Move loyalty transactions
        loyaltyTransactionRepository.findByGuest_IdOrderByTransactionDateDesc(sourceGuestId).forEach(t -> {
            t.setGuest(target);
            loyaltyTransactionRepository.save(t);
        });

        // 3. Move feedback, documents, communications, incidents
        guestFeedbackRepository.findByGuest_IdOrderBySubmittedAtDesc(sourceGuestId).forEach(f -> {
            f.setGuest(target);
            guestFeedbackRepository.save(f);
        });
        guestDocumentRepository.findByGuest_IdOrderByCreatedAtDesc(sourceGuestId).forEach(d -> {
            d.setGuest(target);
            guestDocumentRepository.save(d);
        });
        guestCommunicationRepository.findByGuest_IdOrderByCreatedAtDesc(sourceGuestId).forEach(c -> {
            c.setGuest(target);
            guestCommunicationRepository.save(c);
        });
        sensitiveIncidentRepository
                .findByHotel_IdAndGuest_IdOrderByReportedAtDesc(hotelId, sourceGuestId)
                .forEach(i -> {
                    i.setGuest(target);
                    sensitiveIncidentRepository.save(i);
                });

        // 4. Sync target points/tier
        recalculateGuestLoyalty(target);

        // 5. Delete source
        guestRepository.delete(source);
    }

    @Transactional
    public void recalculateAllLoyalty(UUID hotelId) {
        tenantAccessService.assertHotelAccess(hotelId, null);
        guestRepository.findByHotel_Id(hotelId).forEach(this::recalculateGuestLoyalty);
    }

    private void recalculateGuestLoyalty(Guest g) {
        long totalPoints = loyaltyTransactionRepository.sumPostedPointsByGuestId(g.getId());
        g.setLoyaltyPoints(totalPoints);
        g.setLoyaltyTier(tierFromPoints(totalPoints));
        guestRepository.save(g);
    }

    @Transactional
    public GuestDtos.GuestSearchHit updateGuest(UUID hotelId, String hotelHeader, UUID guestId, ApiDtos.GuestInput input) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (input == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        Guest guest = guestRepository
                .findByIdAndHotel_Id(guestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Guest not found"));
        Role role = tenantAccessService.currentUser().getRole();
        if (!isManagerRole(role) && touchesBlacklist(input)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only hotel managers can change blacklist fields");
        }
        if (!isManagerRole(role) && touchesStaffOnlyNotes(input)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only hotel managers can change internal or behavior notes");
        }
        GuestInputApplier.mergeGuestFromInput(hotelId, guest, input, guestRepository);
        guestRepository.save(guest);
        return toSearchHit(guest);
    }

    @Transactional(readOnly = true)
    public List<GuestDtos.GuestDocumentRow> listDocuments(UUID hotelId, String hotelHeader, UUID guestId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGuestInHotel(guestId, hotelId);
        return guestDocumentRepository.findByGuest_IdOrderByCreatedAtDesc(guestId).stream()
                .map(GuestService::toDocumentRow)
                .toList();
    }

    @Transactional
    public GuestDtos.GuestDocumentRow addDocument(
            UUID hotelId, String hotelHeader, UUID guestId, GuestDtos.GuestDocumentCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Guest guest = assertGuestInHotel(guestId, hotelId);
        GuestDocument d = new GuestDocument();
        d.setGuest(guest);
        d.setDocumentType(req.documentType().trim());
        d.setFileUrl(req.fileUrl().trim());
        d.setFileName(req.fileName() != null && !req.fileName().isBlank() ? req.fileName().trim() : null);
        d.setExpiryDate(req.expiryDate());
        d.setCreatedBy(appUserRepository.getReferenceById(tenantAccessService.currentUser().getId()));
        d = guestDocumentRepository.save(d);
        return toDocumentRow(d);
    }

    @Transactional
    public void deleteDocument(UUID hotelId, String hotelHeader, UUID guestId, UUID documentId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGuestInHotel(guestId, hotelId);
        GuestDocument d = guestDocumentRepository
                .findByIdAndGuest_Id(documentId, guestId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found"));
        guestDocumentRepository.delete(d);
    }

    @Transactional(readOnly = true)
    public List<GuestDtos.GuestCommunicationRow> listCommunications(UUID hotelId, String hotelHeader, UUID guestId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGuestInHotel(guestId, hotelId);
        return guestCommunicationRepository.findByGuest_IdOrderByCreatedAtDesc(guestId).stream()
                .map(GuestService::toCommunicationRow)
                .toList();
    }

    @Transactional
    public GuestDtos.GuestCommunicationRow logCommunication(
            UUID hotelId, String hotelHeader, UUID guestId, GuestDtos.GuestCommunicationCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Guest guest = assertGuestInHotel(guestId, hotelId);
        GuestCommunication c = new GuestCommunication();
        c.setGuest(guest);
        c.setChannel(req.channel().trim().toUpperCase());
        c.setSubject(req.subject() != null ? req.subject().trim() : null);
        c.setBody(req.body());
        if (req.reservationId() != null) {
            Reservation r = reservationRepository
                    .findByIdAndHotel_Id(req.reservationId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
            if (!r.getGuest().getId().equals(guestId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Reservation does not belong to this guest");
            }
            c.setReservation(r);
        }
        c.setCreatedBy(appUserRepository.getReferenceById(tenantAccessService.currentUser().getId()));
        c = guestCommunicationRepository.save(c);
        return toCommunicationRow(c);
    }

    @Transactional(readOnly = true)
    public List<GuestDtos.SensitiveIncidentRow> listIncidents(UUID hotelId, String hotelHeader, UUID guestId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGuestInHotel(guestId, hotelId);
        Role role = tenantAccessService.currentUser().getRole();
        if (!isManagerRole(role)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Sensitive incidents are visible to managers only");
        }
        return sensitiveIncidentRepository.findByHotel_IdAndGuest_IdOrderByReportedAtDesc(hotelId, guestId).stream()
                .map(GuestService::toIncidentRow)
                .toList();
    }

    @Transactional
    public GuestDtos.SensitiveIncidentRow addIncident(
            UUID hotelId, String hotelHeader, UUID guestId, GuestDtos.SensitiveIncidentCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        assertGuestInHotel(guestId, hotelId);
        Role role = tenantAccessService.currentUser().getRole();
        if (!isManagerRole(role)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only managers can log sensitive incidents");
        }
        Guest guest = guestRepository.findByIdAndHotel_Id(guestId, hotelId).orElseThrow();
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow();
        SensitiveIncident i = new SensitiveIncident();
        i.setHotel(hotel);
        i.setGuest(guest);
        i.setIncidentType(req.incidentType().trim().toUpperCase());
        i.setSeverity(
                req.severity() != null && !req.severity().isBlank()
                        ? req.severity().trim().toUpperCase()
                        : "MEDIUM");
        i.setDescription(req.description().trim());
        i.setActionTaken(req.actionTaken() != null ? req.actionTaken().trim() : null);
        i.setReportedBy(appUserRepository.getReferenceById(tenantAccessService.currentUser().getId()));
        i = sensitiveIncidentRepository.save(i);
        return toIncidentRow(i);
    }

    @Transactional
    public GuestDtos.ComplaintBoardRow logComplaint(
            UUID hotelId, String hotelHeader, UUID guestId, GuestDtos.GuestComplaintCreateRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Guest guest = assertGuestInHotel(guestId, hotelId);
        GuestFeedback fb = new GuestFeedback();
        fb.setGuest(guest);
        if (req.reservationId() != null) {
            Reservation r = reservationRepository
                    .findByIdAndHotel_Id(req.reservationId(), hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Reservation not found"));
            if (!r.getGuest().getId().equals(guestId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Reservation does not belong to this guest");
            }
            fb.setReservation(r);
        }
        fb.setCategory(req.category() != null ? req.category().trim() : "GENERAL");
        fb.setComment(req.description().trim());
        fb.setRating(req.rating() != null ? req.rating() : 3);
        fb.setSource(com.hms.domain.GuestFeedbackSource.IN_PERSON);
        fb.setResolved(false);
        fb = guestFeedbackRepository.save(fb);
        return toComplaintBoardRow(fb);
    }

    @Transactional(readOnly = true)
    public List<GuestDtos.ComplaintBoardRow> complaintBoard(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return guestFeedbackRepository
                .findRecentForHotelWithGuest(hotelId, PageRequest.of(0, 100))
                .stream()
                .map(GuestService::toComplaintBoardRow)
                .toList();
    }

    private Guest assertGuestInHotel(UUID guestId, UUID hotelId) {
        return guestRepository
                .findByIdAndHotel_Id(guestId, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Guest not found"));
    }

    private static boolean isManagerRole(Role role) {
        return role == Role.SUPER_ADMIN || role == Role.HOTEL_ADMIN || role == Role.MANAGER;
    }

    private static boolean touchesBlacklist(ApiDtos.GuestInput g) {
        return g.isBlacklisted() != null
                || (g.blacklistReason() != null && !g.blacklistReason().isBlank());
    }

    private static boolean touchesStaffOnlyNotes(ApiDtos.GuestInput g) {
        return g.internalNotes() != null || g.behaviorNotes() != null;
    }

    private Map<String, Object> buildRegistry(UUID hotelId, UUID guestId, Guest g) {
        Map<String, Object> reg = new HashMap<>();
        reg.put("guestType", g.getGuestType() != null ? g.getGuestType() : "RETURNING");
        reg.put("loyaltyMemberNumber", g.getLoyaltyMemberNumber());
        Map<String, Object> emergency = new HashMap<>();
        emergency.put("name", g.getEmergencyContactName());
        emergency.put("phone", g.getEmergencyContactPhone());
        emergency.put("relation", g.getEmergencyContactRelation());
        reg.put("emergencyContact", emergency);
        Map<String, Object> corp = new HashMap<>();
        corp.put("companyName", g.getCorporateCompanyName());
        corp.put("accountCode", g.getCorporateAccountCode());
        corp.put("billingInstructions", g.getCorporateBillingInstructions());
        corp.put("creditLimit", g.getCorporateCreditLimit());
        corp.put("negotiatedRateNote", g.getCorporateNegotiatedRateNote());
        reg.put("corporate", corp);
        reg.put("internalNotes", g.getInternalNotes());
        reg.put("behaviorNotes", g.getBehaviorNotes());
        reg.put("documents", documentRows(guestId));
        reg.put("communications", communicationRows(guestId));
        Role role = tenantAccessService.currentUser().getRole();
        if (isManagerRole(role)) {
            reg.put(
                    "sensitiveIncidents",
                    sensitiveIncidentRepository.findByHotel_IdAndGuest_IdOrderByReportedAtDesc(hotelId, guestId).stream()
                            .map(GuestService::toIncidentRowMap)
                            .toList());
        } else {
            reg.put("sensitiveIncidents", List.of());
        }
        reg.put("activeStay", summarizeInHouseStay(hotelId, guestId));
        return reg;
    }

    private List<Map<String, Object>> documentRows(UUID guestId) {
        return guestDocumentRepository.findByGuest_IdOrderByCreatedAtDesc(guestId).stream()
                .map(GuestService::toDocumentRowMap)
                .toList();
    }

    private List<Map<String, Object>> communicationRows(UUID guestId) {
        return guestCommunicationRepository.findByGuest_IdOrderByCreatedAtDesc(guestId).stream()
                .map(GuestService::toCommunicationRowMap)
                .toList();
    }

    private static GuestDtos.GuestDocumentRow toDocumentRow(GuestDocument d) {
        return new GuestDtos.GuestDocumentRow(
                d.getId(), d.getDocumentType(), d.getFileUrl(), d.getFileName(), d.getExpiryDate(), d.getCreatedAt());
    }

    private static GuestDtos.GuestCommunicationRow toCommunicationRow(GuestCommunication c) {
        return new GuestDtos.GuestCommunicationRow(
                c.getId(),
                c.getChannel(),
                c.getSubject(),
                c.getBody(),
                c.getReservation() != null ? c.getReservation().getId() : null,
                c.getCreatedAt());
    }

    private static Map<String, Object> toCommunicationRowMap(GuestCommunication c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId().toString());
        m.put("channel", c.getChannel());
        m.put("subject", c.getSubject());
        m.put("body", c.getBody());
        m.put("reservationId", c.getReservation() != null ? c.getReservation().getId().toString() : null);
        m.put("createdAt", c.getCreatedAt());
        return m;
    }

    private static Map<String, Object> toDocumentRowMap(GuestDocument d) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", d.getId().toString());
        m.put("document_type", d.getDocumentType());
        m.put("file_url", d.getFileUrl());
        m.put("file_name", d.getFileName());
        m.put("expiry_date", d.getExpiryDate());
        m.put("created_at", d.getCreatedAt());
        return m;
    }

    private static GuestDtos.SensitiveIncidentRow toIncidentRow(SensitiveIncident i) {
        return new GuestDtos.SensitiveIncidentRow(
                i.getId(),
                i.getIncidentType(),
                i.getSeverity(),
                i.getDescription(),
                i.getActionTaken(),
                i.getReportedAt());
    }

    private static Map<String, Object> toIncidentRowMap(SensitiveIncident i) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", i.getId().toString());
        m.put("incident_type", i.getIncidentType());
        m.put("severity", i.getSeverity());
        m.put("description", i.getDescription());
        m.put("action_taken", i.getActionTaken());
        m.put("reported_at", i.getReportedAt());
        return m;
    }

    private static GuestDtos.ComplaintBoardRow toComplaintBoardRow(GuestFeedback f) {
        Guest g = f.getGuest();
        String guestName =
                g.getFullName() != null && !g.getFullName().isBlank()
                        ? g.getFullName().trim()
                        : g.getFirstName() + " " + g.getLastName();
        return new GuestDtos.ComplaintBoardRow(
                f.getId(),
                g.getId(),
                guestName,
                f.getCategory(),
                f.getComment(),
                f.getRating(),
                f.isResolved(),
                f.getResolutionNotes(),
                f.getSubmittedAt(),
                f.getReservation() != null ? f.getReservation().getId() : null);
    }

    private Map<String, Object> summarizeInHouseStay(UUID hotelId, UUID guestId) {
        return reservationRepository.findByHotel_IdAndGuest_IdOrderByCheckInDateDesc(hotelId, guestId).stream()
                .filter(r -> r.getStatus() == ReservationStatus.CHECKED_IN)
                .findFirst()
                .map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("reservationId", r.getId().toString());
                    m.put("roomNumber", r.getRoom() != null ? r.getRoom().getRoomNumber() : "");
                    m.put("checkInDate", r.getCheckInDate().toString());
                    m.put("checkOutDate", r.getCheckOutDate().toString());
                    return m;
                })
                .orElse(Map.of());
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of("raw", json);
        }
    }

    private Map<String, Object> documentComplianceBlock(UUID guestId) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate horizon = today.plusDays(30);
        List<Map<String, Object>> expired = new ArrayList<>();
        List<Map<String, Object>> expiringSoon = new ArrayList<>();
        for (GuestDocument d : guestDocumentRepository.findByGuest_IdOrderByCreatedAtDesc(guestId)) {
            LocalDate exp = d.getExpiryDate();
            if (exp == null) {
                continue;
            }
            Map<String, Object> row = new HashMap<>();
            row.put("id", d.getId().toString());
            row.put("document_type", d.getDocumentType());
            row.put("expiry_date", exp.toString());
            if (exp.isBefore(today)) {
                expired.add(row);
            } else if (!exp.isAfter(horizon)) {
                expiringSoon.add(row);
            }
        }
        Map<String, Object> block = new HashMap<>();
        block.put("expired", expired);
        block.put("expiringWithin30Days", expiringSoon);
        return block;
    }
}
