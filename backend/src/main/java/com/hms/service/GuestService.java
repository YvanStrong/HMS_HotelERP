package com.hms.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.GuestDtos;
import com.hms.domain.LoyaltyTier;
import com.hms.domain.LoyaltyTxnStatus;
import com.hms.domain.LoyaltyTxnType;
import com.hms.domain.RedemptionType;
import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.LoyaltyTransaction;
import com.hms.repository.AppUserRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.LoyaltyTransactionRepository;
import com.hms.repository.ReservationRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
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

    public GuestService(
            GuestRepository guestRepository,
            ReservationRepository reservationRepository,
            LoyaltyTransactionRepository loyaltyTransactionRepository,
            TenantAccessService tenantAccessService,
            ObjectMapper objectMapper,
            HotelRepository hotelRepository,
            AppUserRepository appUserRepository) {
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.loyaltyTransactionRepository = loyaltyTransactionRepository;
        this.tenantAccessService = tenantAccessService;
        this.objectMapper = objectMapper;
        this.hotelRepository = hotelRepository;
        this.appUserRepository = appUserRepository;
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
                g.isMarketingConsent());
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

        Map<String, Object> comm = new HashMap<>();
        comm.put("emailOptIn", g.isEmailOptIn());
        comm.put("smsOptIn", g.isSmsOptIn());
        comm.put("preferredLanguage", g.getPreferredLanguage());
        comm.put("doNotContactUntil", null);

        boolean vip = g.getLoyaltyTier() == LoyaltyTier.PLATINUM
                || ltv.compareTo(new BigDecimal("10000")) > 0;
        Map<String, Object> flags = new HashMap<>();
        flags.put("isVIP", vip);
        flags.put("requiresSpecialAttention", false);
        flags.put("blacklisted", false);

        String name = g.getFirstName() + " " + g.getLastName();
        return new GuestDtos.GuestProfileResponse(
                g.getId(), name, g.getEmail(), loyalty, prefs, stay, comm, flags);
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
        long prev = g.getLoyaltyPoints();
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
        if (g.getLoyaltyPoints() < req.pointsToRedeem()) {
            throw new ApiException(HttpStatus.CONFLICT, "Insufficient loyalty points");
        }
        RedemptionType rtype = RedemptionType.valueOf(req.redemptionType().trim().toUpperCase());
        long prev = g.getLoyaltyPoints();
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
        m.put("tier", g.getLoyaltyTier().name());
        m.put("points", g.getLoyaltyPoints());
        long p = g.getLoyaltyPoints();
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
}
