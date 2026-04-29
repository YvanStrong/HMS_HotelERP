package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.SubscriptionStatus;
import com.hms.domain.PlatformBillingCycle;
import com.hms.domain.PlatformBillingStatus;
import com.hms.domain.ProvisioningStatus;
import com.hms.domain.SubscriptionTier;
import com.hms.entity.Hotel;
import com.hms.entity.PlatformTenant;
import com.hms.repository.AppUserRepository;
import com.hms.repository.DailyRevenueSnapshotRepository;
import com.hms.repository.FacilityRepository;
import com.hms.repository.FbOutletRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.HousekeepingRestockTaskRepository;
import com.hms.repository.InventoryCategoryRepository;
import com.hms.repository.InventoryItemRepository;
import com.hms.repository.InvoiceRepository;
import com.hms.repository.PlatformTenantRepository;
import com.hms.repository.PlatformUsageMetricRepository;
import com.hms.repository.PurchaseOrderRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomBlockRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomStatusLogRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.repository.SupplierRepository;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HotelProvisioningService {

    private final HotelRepository hotelRepository;
    private final PlatformTenantRepository platformTenantRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;
    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;
    private final AppUserRepository appUserRepository;
    private final InventoryCategoryRepository inventoryCategoryRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final FacilityRepository facilityRepository;
    private final SupplierRepository supplierRepository;
    private final FbOutletRepository fbOutletRepository;
    private final DailyRevenueSnapshotRepository dailyRevenueSnapshotRepository;
    private final HousekeepingRestockTaskRepository housekeepingRestockTaskRepository;
    private final InvoiceRepository invoiceRepository;
    private final RoomBlockRepository roomBlockRepository;
    private final RoomStatusLogRepository roomStatusLogRepository;
    private final PlatformUsageMetricRepository platformUsageMetricRepository;
    private final HotelPurgeService hotelPurgeService;
    private final PlatformStaffUserService platformStaffUserService;

    public HotelProvisioningService(
            HotelRepository hotelRepository,
            PlatformTenantRepository platformTenantRepository,
            RoomTypeRepository roomTypeRepository,
            RoomRepository roomRepository,
            GuestRepository guestRepository,
            ReservationRepository reservationRepository,
            AppUserRepository appUserRepository,
            InventoryCategoryRepository inventoryCategoryRepository,
            InventoryItemRepository inventoryItemRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            FacilityRepository facilityRepository,
            SupplierRepository supplierRepository,
            FbOutletRepository fbOutletRepository,
            DailyRevenueSnapshotRepository dailyRevenueSnapshotRepository,
            HousekeepingRestockTaskRepository housekeepingRestockTaskRepository,
            InvoiceRepository invoiceRepository,
            RoomBlockRepository roomBlockRepository,
            RoomStatusLogRepository roomStatusLogRepository,
            PlatformUsageMetricRepository platformUsageMetricRepository,
            HotelPurgeService hotelPurgeService,
            PlatformStaffUserService platformStaffUserService) {
        this.hotelRepository = hotelRepository;
        this.platformTenantRepository = platformTenantRepository;
        this.roomTypeRepository = roomTypeRepository;
        this.roomRepository = roomRepository;
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.appUserRepository = appUserRepository;
        this.inventoryCategoryRepository = inventoryCategoryRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.facilityRepository = facilityRepository;
        this.supplierRepository = supplierRepository;
        this.fbOutletRepository = fbOutletRepository;
        this.dailyRevenueSnapshotRepository = dailyRevenueSnapshotRepository;
        this.housekeepingRestockTaskRepository = housekeepingRestockTaskRepository;
        this.invoiceRepository = invoiceRepository;
        this.roomBlockRepository = roomBlockRepository;
        this.roomStatusLogRepository = roomStatusLogRepository;
        this.platformUsageMetricRepository = platformUsageMetricRepository;
        this.hotelPurgeService = hotelPurgeService;
        this.platformStaffUserService = platformStaffUserService;
    }

    @Transactional
    public Hotel createHotel(ApiDtos.HotelCreateInput in) {
        String code = resolveUniqueHotelCode(in.code(), in.name());
        Hotel h = new Hotel();
        h.setName(in.name().trim());
        h.setCode(code);
        h.setTimezone(
                in.timezone() != null && !in.timezone().isBlank() ? in.timezone().trim() : "UTC");
        h.setCurrency(
                in.currency() != null && !in.currency().isBlank() ? in.currency().trim() : "USD");
        h.setSubscriptionStatus(resolveSubscriptionForCreate(in));
        applyMarketingFieldsFromCreate(h, in);
        hotelRepository.save(h);
        ensureDefaultPlatformTenant(h);
        platformTenantRepository
                .findById(h.getId())
                .ifPresent(pt -> {
                    pt.setHotelName(h.getName());
                    if (in.email() != null && !in.email().isBlank()) {
                        pt.setContactEmail(in.email().trim());
                    }
                    if (in.phone() != null && !in.phone().isBlank()) {
                        pt.setContactPhone(in.phone().trim());
                    }
                    platformTenantRepository.save(pt);
                });
        if (in.adminUsername() != null
                && !in.adminUsername().isBlank()
                && in.adminPassword() != null
                && !in.adminPassword().isBlank()) {
            platformStaffUserService.createHotelScopedUser(
                    h.getId(), in.adminUsername(), in.adminPassword(), in.email(), "HOTEL_ADMIN");
        }
        return h;
    }

    private SubscriptionStatus resolveSubscriptionForCreate(ApiDtos.HotelCreateInput in) {
        if (in.isActive() != null) {
            if (Boolean.FALSE.equals(in.isActive())) {
                return SubscriptionStatus.SUSPENDED;
            }
            return SubscriptionStatus.ACTIVE;
        }
        return parseSubscription(in.subscriptionStatus());
    }

    private void applyMarketingFieldsFromCreate(Hotel h, ApiDtos.HotelCreateInput in) {
        if (in.description() != null && !in.description().isBlank()) {
            h.setDescription(in.description().trim());
        }
        if (in.address() != null && !in.address().isBlank()) {
            h.setAddress(in.address().trim());
        }
        if (in.phone() != null && !in.phone().isBlank()) {
            h.setPhone(in.phone().trim());
        }
        if (in.email() != null && !in.email().isBlank()) {
            h.setEmail(in.email().trim());
        }
        if (in.imageUrl() != null && !in.imageUrl().isBlank()) {
            h.setImageUrl(in.imageUrl().trim());
        }
        if (in.logoUrl() != null && !in.logoUrl().isBlank()) {
            h.setLogoUrl(in.logoUrl().trim());
        }
        if (in.starRating() != null && in.starRating() >= 1 && in.starRating() <= 5) {
            h.setStarRating(in.starRating());
        }
    }

    private String resolveUniqueHotelCode(String requestedCode, String hotelName) {
        String base;
        if (requestedCode != null && !requestedCode.isBlank()) {
            base = requestedCode.trim().toUpperCase().replaceAll("[^A-Z0-9-]", "");
        } else {
            base = hotelName.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        }
        if (base.isBlank()) {
            base = "HOTEL";
        }
        if (base.length() > 58) {
            base = base.substring(0, 58);
        }
        String candidate = base;
        int n = 0;
        while (hotelRepository.existsByCodeIgnoreCase(candidate)) {
            String suffix = String.valueOf(++n);
            candidate = base.substring(0, Math.min(64 - suffix.length(), base.length())) + suffix;
        }
        return candidate;
    }

    @Transactional
    public Hotel updateHotel(UUID hotelId, ApiDtos.HotelUpdateInput in) {
        Hotel h = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        if (in.name() == null || in.name().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name is required");
        }
        h.setName(in.name().trim());

        if (in.code() != null && !in.code().isBlank()) {
            String newCode = in.code().trim().toUpperCase();
            if (hotelRepository.existsByCodeIgnoreCaseAndIdNot(newCode, hotelId)) {
                throw new ApiException(HttpStatus.CONFLICT, "Hotel code already exists");
            }
            h.setCode(newCode);
        }

        if (in.currency() != null && !in.currency().isBlank()) {
            h.setCurrency(in.currency().trim());
        }
        if (in.timezone() != null && !in.timezone().isBlank()) {
            h.setTimezone(in.timezone().trim());
        }

        if (in.isActive() != null) {
            if (Boolean.FALSE.equals(in.isActive())) {
                h.setSubscriptionStatus(SubscriptionStatus.SUSPENDED);
            } else {
                h.setSubscriptionStatus(SubscriptionStatus.ACTIVE);
            }
        }

        if (in.description() != null) {
            String d = in.description().trim();
            h.setDescription(d.isEmpty() ? null : d);
        }
        if (in.address() != null) {
            String a = in.address().trim();
            h.setAddress(a.isEmpty() ? null : a);
        }
        if (in.phone() != null) {
            String p = in.phone().trim();
            h.setPhone(p.isEmpty() ? null : p);
        }
        if (in.email() != null) {
            String em = in.email().trim();
            h.setEmail(em.isEmpty() ? null : em);
        }
        if (in.imageUrl() != null) {
            String iu = in.imageUrl().trim();
            h.setImageUrl(iu.isEmpty() ? null : iu);
        }
        if (in.logoUrl() != null) {
            String lu = in.logoUrl().trim();
            h.setLogoUrl(lu.isEmpty() ? null : lu);
        }
        if (in.starRating() != null) {
            int sr = in.starRating();
            h.setStarRating(sr >= 1 && sr <= 5 ? sr : null);
        }

        hotelRepository.save(h);

        platformTenantRepository
                .findById(hotelId)
                .ifPresent(pt -> {
                    pt.setHotelName(h.getName());
                    if (in.email() != null) {
                        String e = in.email().trim();
                        pt.setContactEmail(e.isEmpty() ? null : e);
                    }
                    if (in.phone() != null) {
                        String p = in.phone().trim();
                        pt.setContactPhone(p.isEmpty() ? null : p);
                    }
                    platformTenantRepository.save(pt);
                });

        return h;
    }

    @Transactional
    public void deleteHotel(UUID hotelId, boolean purgeData) {
        if (!hotelRepository.existsById(hotelId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Hotel not found");
        }
        if (purgeData) {
            try {
                hotelPurgeService.purgeAllHotelScopedRows(hotelId);
            } catch (DataIntegrityViolationException ex) {
                String hint =
                        ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "Hotel purge hit a foreign-key dependency that is not deleted yet in HotelPurgeService. "
                                + (hint != null ? hint : "See server logs."));
            }
        } else {
            String blockers = describeHotelDeleteBlockers(hotelId);
            if (blockers != null) {
                throw new ApiException(HttpStatus.CONFLICT, blockers);
            }
        }
        // Do not re-run describeHotelDeleteBlockers after purge=true: JDBC deletes are authoritative; a second JPA
        // count pass was producing false 409s even when the DB was empty. Any remaining FKs surface on delete below.
        platformTenantRepository.deleteById(hotelId);
        try {
            hotelRepository.deleteById(hotelId);
            hotelRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            String hint = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Cannot delete this hotel: the database still has linked rows that were not checked here. "
                            + (hint != null ? hint : "Remove dependent data and try again."));
        }
    }

    /**
     * Explains why a hotel row cannot be removed. PostgreSQL enforces FK on many tables—not only
     * {@code reservations}—e.g. {@code room_types} and {@code guests} block deletion even when there are zero stays.
     */
    private String describeHotelDeleteBlockers(UUID hotelId) {
        List<String> parts = new ArrayList<>();
        addCount(parts, roomTypeRepository.countByHotel_Id(hotelId), "room type(s)");
        addCount(parts, roomRepository.countAllRowsForHotel(hotelId), "room row(s) (including soft-deleted)");
        addCount(parts, guestRepository.countByHotel_Id(hotelId), "guest profile(s)");
        addCount(parts, reservationRepository.countByHotel_Id(hotelId), "reservation(s)");
        addCount(parts, appUserRepository.countByHotel_Id(hotelId), "staff user(s) tied to this hotel");
        addCount(parts, inventoryCategoryRepository.countByHotel_Id(hotelId), "inventory categor(ies/y)");
        addCount(parts, inventoryItemRepository.countByHotel_Id(hotelId), "inventory item(s)");
        addCount(parts, purchaseOrderRepository.countByHotel_Id(hotelId), "purchase order(s)");
        addCount(parts, facilityRepository.countByHotel_Id(hotelId), "facilit(ies/y)");
        addCount(parts, supplierRepository.countByHotel_Id(hotelId), "supplier(s)");
        addCount(parts, fbOutletRepository.countByHotel_Id(hotelId), "F&B outlet(s)");
        addCount(parts, dailyRevenueSnapshotRepository.countByHotel_Id(hotelId), "revenue snapshot row(s)");
        addCount(parts, housekeepingRestockTaskRepository.countByHotel_Id(hotelId), "housekeeping restock task(s)");
        addCount(parts, invoiceRepository.countByHotel_Id(hotelId), "invoice(s)");
        addCount(parts, roomBlockRepository.countByHotel_Id(hotelId), "room block(s)");
        addCount(parts, roomStatusLogRepository.countByHotelId(hotelId), "room status log row(s)");
        addCount(parts, platformUsageMetricRepository.countByTenantId(hotelId), "platform usage metric row(s)");
        if (parts.isEmpty()) {
            return null;
        }
        long resCount = reservationRepository.countByHotel_Id(hotelId);
        String hint = resCount > 0
                ? " Retry with DELETE ?purge=true (super-admin only) to remove all hotel-scoped rows in one irreversible step."
                : " PostgreSQL blocks deleting the hotel row until these links are gone (this can happen even when reservation count is zero). Retry with DELETE ?purge=true if you intend to wipe the property entirely.";
        return "Cannot delete this hotel while it still has: " + String.join(", ", parts) + "." + hint;
    }

    private static void addCount(List<String> parts, long n, String label) {
        if (n > 0) {
            parts.add(n + " " + label);
        }
    }

    /** Backfills {@link PlatformTenant} for hotels created before platform module or without a row. */
    @Transactional
    public void syncPlatformTenant(Hotel h) {
        ensureDefaultPlatformTenant(h);
    }

    private void ensureDefaultPlatformTenant(Hotel h) {
        if (platformTenantRepository.existsById(h.getId())) {
            return;
        }
        String base = h.getCode() != null ? h.getCode().toLowerCase().replaceAll("[^a-z0-9]", "") : "hotel";
        if (base.isBlank()) {
            base = "hotel";
        }
        String subdomain = base;
        int n = 0;
        while (platformTenantRepository.existsBySubdomainIgnoreCase(subdomain)) {
            subdomain = base + (++n);
        }
        PlatformTenant pt = new PlatformTenant();
        pt.setHotel(h);
        pt.setHotelName(h.getName());
        pt.setSubdomain(subdomain);
        pt.setTier(SubscriptionTier.STARTER);
        pt.setBillingCycle(PlatformBillingCycle.MONTHLY);
        pt.setSubscriptionStart(Instant.now());
        pt.setMaxRooms(50);
        pt.setMaxUsers(10);
        pt.setMaxReservationsPerMonth(500);
        pt.setMonthlyPrice(new BigDecimal("99.00"));
        pt.setBillingStatus(PlatformBillingStatus.ACTIVE);
        pt.setProvisioningStatus(ProvisioningStatus.PROVISIONED);
        platformTenantRepository.save(pt);
    }

    private static SubscriptionStatus parseSubscription(String raw) {
        if (raw == null || raw.isBlank()) {
            return SubscriptionStatus.ACTIVE;
        }
        try {
            return SubscriptionStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid subscriptionStatus");
        }
    }
}
