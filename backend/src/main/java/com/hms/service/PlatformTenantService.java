package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.ApiDtos;
import com.hms.api.dto.PlatformDtos;
import com.hms.domain.PlatformBillingCycle;
import com.hms.domain.PlatformBillingStatus;
import com.hms.config.HmsMultitenancyProperties;
import com.hms.domain.ProvisioningJobType;
import com.hms.domain.ProvisioningStatus;
import com.hms.domain.Role;
import com.hms.domain.SubscriptionTier;
import com.hms.domain.SubscriptionStatus;
import com.hms.domain.TenantBillingRequestStatus;
import com.hms.domain.TenantBillingRequestType;
import com.hms.domain.TenantSubscriptionAuditAction;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.entity.PlatformAuditLog;
import com.hms.entity.PlatformTenant;
import com.hms.entity.TenantBillingRequest;
import com.hms.entity.TenantPaymentRecord;
import com.hms.entity.TenantSubscriptionAudit;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.PlatformAuditLogRepository;
import com.hms.repository.PlatformTenantRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.TenantBillingRequestRepository;
import com.hms.repository.TenantPaymentRecordRepository;
import com.hms.repository.TenantSubscriptionAuditRepository;
import com.hms.security.JwtAuthenticationFilter;
import com.hms.security.JwtService;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformTenantService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final HotelRepository hotelRepository;
    private final PlatformTenantRepository platformTenantRepository;
    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final HotelProvisioningService hotelProvisioningService;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TenantAccessService tenantAccessService;
    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;
    private final ObjectMapper objectMapper;
    private final ProvisioningJobService provisioningJobService;
    private final HmsMultitenancyProperties multitenancyProperties;
    private final TenantPaymentRecordRepository tenantPaymentRecordRepository;
    private final TenantSubscriptionAuditRepository tenantSubscriptionAuditRepository;
    private final TenantBillingRequestRepository tenantBillingRequestRepository;
    private final SubscriptionStateResolver subscriptionStateResolver;
    private final TenantSubscriptionGuard tenantSubscriptionGuard;
    private final Clock clock;

    public PlatformTenantService(
            HotelRepository hotelRepository,
            PlatformTenantRepository platformTenantRepository,
            PlatformAuditLogRepository platformAuditLogRepository,
            HotelProvisioningService hotelProvisioningService,
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            TenantAccessService tenantAccessService,
            RoomRepository roomRepository,
            ReservationRepository reservationRepository,
            ObjectMapper objectMapper,
            ProvisioningJobService provisioningJobService,
            HmsMultitenancyProperties multitenancyProperties,
            TenantPaymentRecordRepository tenantPaymentRecordRepository,
            TenantSubscriptionAuditRepository tenantSubscriptionAuditRepository,
            TenantBillingRequestRepository tenantBillingRequestRepository,
            SubscriptionStateResolver subscriptionStateResolver,
            TenantSubscriptionGuard tenantSubscriptionGuard,
            Clock clock) {
        this.hotelRepository = hotelRepository;
        this.platformTenantRepository = platformTenantRepository;
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.hotelProvisioningService = hotelProvisioningService;
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.tenantAccessService = tenantAccessService;
        this.roomRepository = roomRepository;
        this.reservationRepository = reservationRepository;
        this.objectMapper = objectMapper;
        this.provisioningJobService = provisioningJobService;
        this.multitenancyProperties = multitenancyProperties;
        this.tenantPaymentRecordRepository = tenantPaymentRecordRepository;
        this.tenantSubscriptionAuditRepository = tenantSubscriptionAuditRepository;
        this.tenantBillingRequestRepository = tenantBillingRequestRepository;
        this.subscriptionStateResolver = subscriptionStateResolver;
        this.tenantSubscriptionGuard = tenantSubscriptionGuard;
        this.clock = clock;
    }

    @Transactional
    public Map<String, Object> listTenants(String statusParam, String tierParam, String searchParam) {
        backfillMissingTenants();
        PlatformBillingStatus st = parseBillingStatus(statusParam);
        SubscriptionTier tr = parseTier(tierParam);
        String s = searchParam == null || searchParam.isBlank() ? null : searchParam.trim();
        List<PlatformTenant> rows = platformTenantRepository.searchByStatusAndTier(st, tr);
        if (s != null) {
            String needle = s.toLowerCase(Locale.ROOT);
            rows = rows.stream().filter(t -> tenantMatchesSearch(t, needle)).toList();
        }
        List<Map<String, Object>> data = new ArrayList<>();
        BigDecimal mrr = rows.stream()
                .map(PlatformTenant::getMonthlyPrice)
                .map(v -> v != null ? v : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int churnRisk = 0;
        int active = 0;
        for (PlatformTenant t : rows) {
            SubscriptionState state = subscriptionStateResolver.resolve(t);
            if (!state.blocked()) {
                active++;
            }
            Map<String, Object> row = toTenantRow(t);
            boolean highUsage = Boolean.TRUE.equals(row.remove("_highUsage"));
            data.add(row);
            if (state.status() == PlatformBillingStatus.EXPIRING_SOON || highUsage) {
                churnRisk++;
            }
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalTenants", rows.size());
        summary.put("activeTenants", active);
        summary.put("mrr", mrr.setScale(2, RoundingMode.HALF_UP));
        summary.put("churnRisk", churnRisk);
        return Map.of("data", data, "summary", summary);
    }

    private void backfillMissingTenants() {
        for (Hotel h : hotelRepository.findAll()) {
            if (!platformTenantRepository.existsById(h.getId())) {
                hotelProvisioningService.syncPlatformTenant(h);
            }
        }
    }

    private Map<String, Object> toTenantRow(PlatformTenant t) {
        UUID hid = t.getHotel().getId();
        long roomsUsed = roomRepository.countByHotel_Id(hid);
        long usersUsed = appUserRepository.countByHotel_Id(hid);
        YearMonth ym = YearMonth.now(clock);
        Instant start = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        long resUsed = reservationRepository.countByHotel_IdAndCreatedAtBetween(hid, start, end);

        Map<String, Object> rooms = usageBlock(roomsUsed, t.getMaxRooms());
        Map<String, Object> users = usageBlock(usersUsed, t.getMaxUsers());
        Map<String, Object> res = usageBlock(resUsed, t.getMaxReservationsPerMonth());
        boolean highUsage = false;
        if (rooms.get("percent") instanceof Double p && p > 90.0) {
            highUsage = true;
        }
        if (users.get("percent") instanceof Double p && p > 90.0) {
            highUsage = true;
        }
        if (res.get("percent") instanceof Double p && p > 90.0) {
            highUsage = true;
        }

        SubscriptionState state = subscriptionStateResolver.resolve(t);
        Map<String, Object> subscription = new LinkedHashMap<>();
        subscription.put("tier", t.getTier().name());
        subscription.put("status", state.status().name());
        subscription.put("billingCycle", t.getBillingCycle().name());
        subscription.put(
                "nextBillingDate",
                t.getSubscriptionEnd() != null
                        ? LocalDate.ofInstant(t.getSubscriptionEnd(), ZoneOffset.UTC).toString()
                        : null);
        subscription.put("monthlyPrice", t.getMonthlyPrice());
        subscription.put("daysRemaining", state.daysRemaining() == Long.MAX_VALUE ? null : state.daysRemaining());
        subscription.put("suspended", state.blocked());
        subscription.put("manuallyBlocked", t.isManuallyBlocked());
        subscription.put("manualBlockReason", t.getManualBlockReason());
        subscription.put("lastPaymentConfirmedAt", t.getLastPaymentConfirmedAt());

        Map<String, Object> health = Map.of(
                "uptime", 99.98,
                "lastBackup",
                Instant.now(clock).truncatedTo(ChronoUnit.HOURS).toString(),
                "alerts",
                List.of());

        List<Map<String, Object>> actions = List.of(
                Map.of("label", "View Dashboard", "url", "/api/v1/platform/tenants/" + hid + "/dashboard"),
                Map.of("label", "Manage Subscription", "url", "/api/v1/platform/tenants/" + hid + "/subscription"),
                Map.of("label", "Impersonate Admin", "url", "/api/v1/platform/tenants/" + hid + "/impersonate", "method", "POST"));

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("tenantId", hid.toString());
        row.put("hotelName", t.getHotelName());
        row.put("subdomain", t.getSubdomain());
        row.put("subscription", subscription);
        row.put("usage", Map.of("rooms", rooms, "users", users, "reservations", res));
        row.put("health", health);
        row.put("actions", actions);
        row.put("_highUsage", highUsage);
        return row;
    }

    private static Map<String, Object> usageBlock(long used, Integer limit) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("used", used);
        m.put("limit", limit);
        if (limit == null || limit <= 0) {
            m.put("percent", 0.0);
        } else {
            m.put("percent", Math.min(100.0, used * 100.0 / limit));
        }
        return m;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> tenantDashboard(UUID tenantId) {
        PlatformTenant t = platformTenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tenant not found"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tenantId", tenantId.toString());
        out.put("hotel", Map.of("id", tenantId.toString(), "name", t.getHotelName(), "code", t.getHotel().getCode()));
        out.put("row", toTenantRow(t));
        return out;
    }

    @Transactional(readOnly = true)
    public PlatformDtos.TenantSubscriptionStatusResponse subscriptionStatus(UUID tenantId) {
        PlatformTenant tenant = mustTenant(tenantId);
        return toSubscriptionStatusResponse(tenant);
    }

    @Transactional
    public PlatformDtos.TenantSubscriptionStatusResponse renewSubscription(
            UUID tenantId, PlatformDtos.RenewTenantSubscriptionRequest request) {
        int months = request.months() != null ? request.months() : 0;
        if (!List.of(1, 3, 6, 12).contains(months)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RENEWAL_PERIOD", "Renewal months must be 1, 3, 6, or 12.");
        }
        UserPrincipal actor = tenantAccessService.currentUser();
        PlatformTenant tenant = mustTenant(tenantId);
        PlatformBillingStatus previous = tenant.getBillingStatus();
        Instant oldExpiry = tenant.getSubscriptionEnd();
        LocalDate today = LocalDate.now(clock);
        LocalDate currentExpiry = oldExpiry != null ? LocalDate.ofInstant(oldExpiry, ZoneOffset.UTC) : today;
        LocalDate base = currentExpiry.isAfter(today) ? currentExpiry : today;
        Instant newExpiry = base.plusMonths(months).atStartOfDay(ZoneOffset.UTC).toInstant();
        tenant.setSubscriptionEnd(newExpiry);
        if (tenant.getSubscriptionStart() == null) {
            tenant.setSubscriptionStart(today.atStartOfDay(ZoneOffset.UTC).toInstant());
        }
        tenant.setBillingStatus(PlatformBillingStatus.ACTIVE);
        tenant.setManuallyBlocked(false);
        tenant.setManualBlockReason(null);
        tenant.setBlockedAt(null);
        tenant.setBlockedBy(null);
        tenant.setLastPaymentConfirmedAt(Instant.now(clock));
        tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.ACTIVE);
        platformTenantRepository.save(tenant);

        BigDecimal paymentAmount = request.amount();
        if (paymentAmount == null && tenant.getMonthlyPrice() != null) {
            paymentAmount = tenant.getMonthlyPrice().multiply(BigDecimal.valueOf(months));
        }
        TenantPaymentRecord payment = new TenantPaymentRecord();
        payment.setHotelId(tenantId);
        payment.setMonthsPaid(months);
        payment.setAmount(paymentAmount);
        payment.setCurrency(trimOrDefault(request.currency(), tenant.getHotel().getCurrency()));
        payment.setPaymentReference(trimOrNull(request.paymentReference()));
        payment.setConfirmedBy(actor.getId());
        payment.setConfirmedAt(Instant.now(clock));
        payment.setNote(trimOrNull(request.note()));
        payment.setCreatedAt(Instant.now(clock));
        tenantPaymentRecordRepository.save(payment);

        auditSubscription(
                tenantId,
                TenantSubscriptionAuditAction.RENEWAL,
                previous,
                tenant.getBillingStatus(),
                actor.getId(),
                request.note(),
                oldExpiry,
                newExpiry);
        tenantSubscriptionGuard.evict(tenantId);
        return toSubscriptionStatusResponse(tenant);
    }

    @Transactional
    public PlatformDtos.TenantSubscriptionStatusResponse changePlan(
            UUID tenantId, PlatformDtos.ChangePlanRequest request) {
        SubscriptionTier target = parseTierRequired(request.tier());
        UserPrincipal actor = tenantAccessService.currentUser();
        PlatformTenant tenant = mustTenant(tenantId);
        SubscriptionTier current = tenant.getTier() != null ? tenant.getTier() : SubscriptionTier.STARTER;
        if (target == current) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SAME_PLAN", "Tenant is already on " + target.name());
        }
        LocalDate today = LocalDate.now(clock);
        LocalDate expiry = tenant.getSubscriptionEnd() != null
                ? LocalDate.ofInstant(tenant.getSubscriptionEnd(), ZoneOffset.UTC)
                : today;
        BigDecimal oldMonthly = tenant.getMonthlyPrice() != null
                ? tenant.getMonthlyPrice()
                : SubscriptionPlanCatalog.plan(current).monthlyPrice();
        BigDecimal newMonthly = SubscriptionPlanCatalog.plan(target).monthlyPrice();
        BigDecimal quoted = SubscriptionPlanCatalog.proratedUpgradeAmount(oldMonthly, newMonthly, today, expiry);
        if (SubscriptionPlanCatalog.tierRank(target) < SubscriptionPlanCatalog.tierRank(current)) {
            quoted = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal paymentAmount = request.amount() != null ? request.amount() : quoted;

        PlatformBillingStatus previous = tenant.getBillingStatus();
        Instant oldExpiry = tenant.getSubscriptionEnd();
        tenant.setTier(target);
        applyTierDefaults(tenant, target, null);
        if (!tenant.isManuallyBlocked()) {
            if (expiry.isBefore(today)) {
                tenant.setBillingStatus(PlatformBillingStatus.EXPIRED);
                tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.SUSPENDED);
            } else {
                tenant.setBillingStatus(
                        ChronoUnit.DAYS.between(today, expiry) <= SubscriptionStateResolver.EXPIRING_SOON_DAYS
                                ? PlatformBillingStatus.EXPIRING_SOON
                                : PlatformBillingStatus.ACTIVE);
                tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.ACTIVE);
            }
        }
        if (paymentAmount != null && paymentAmount.compareTo(BigDecimal.ZERO) > 0) {
            tenant.setLastPaymentConfirmedAt(Instant.now(clock));
        }
        platformTenantRepository.save(tenant);

        if (paymentAmount != null && paymentAmount.compareTo(BigDecimal.ZERO) > 0) {
            TenantPaymentRecord payment = new TenantPaymentRecord();
            payment.setHotelId(tenantId);
            payment.setMonthsPaid(0);
            payment.setAmount(paymentAmount.setScale(2, RoundingMode.HALF_UP));
            payment.setCurrency(trimOrDefault(request.currency(), tenant.getHotel().getCurrency()));
            payment.setPaymentReference(trimOrNull(request.paymentReference()));
            payment.setConfirmedBy(actor.getId());
            payment.setConfirmedAt(Instant.now(clock));
            payment.setNote(trimOrDefault(
                    request.note(),
                    "Plan change " + current.name() + " → " + target.name() + " (prorated)"));
            payment.setCreatedAt(Instant.now(clock));
            tenantPaymentRecordRepository.save(payment);
        }

        auditSubscription(
                tenantId,
                TenantSubscriptionAuditAction.PLAN_CHANGE,
                previous,
                tenant.getBillingStatus(),
                actor.getId(),
                "Plan " + current.name() + " → " + target.name() + "; due=" + paymentAmount,
                oldExpiry,
                tenant.getSubscriptionEnd());
        tenantSubscriptionGuard.evict(tenantId);
        return toSubscriptionStatusResponse(tenant);
    }

    @Transactional
    public PlatformDtos.TenantSubscriptionStatusResponse createBillingRequest(
            UUID hotelId, PlatformDtos.CreateBillingRequest request) {
        UserPrincipal actor = tenantAccessService.currentUser();
        PlatformTenant tenant = mustTenant(hotelId);
        TenantBillingRequestType type;
        try {
            type = TenantBillingRequestType.valueOf(request.requestType().trim().toUpperCase());
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_TYPE", "requestType must be RENEW or UPGRADE");
        }
        LocalDate today = LocalDate.now(clock);
        LocalDate expiry = tenant.getSubscriptionEnd() != null
                ? LocalDate.ofInstant(tenant.getSubscriptionEnd(), ZoneOffset.UTC)
                : today;
        BigDecimal quoted;
        SubscriptionTier targetTier = null;
        Integer months = null;
        if (type == TenantBillingRequestType.RENEW) {
            months = request.months() != null ? request.months() : 1;
            if (!List.of(1, 3, 6, 12).contains(months)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RENEWAL_PERIOD", "Renewal months must be 1, 3, 6, or 12.");
            }
            quoted = SubscriptionPlanCatalog.renewAmount(tenant.getMonthlyPrice(), months);
        } else {
            targetTier = parseTierRequired(request.targetTier());
            SubscriptionTier current = tenant.getTier() != null ? tenant.getTier() : SubscriptionTier.STARTER;
            if (SubscriptionPlanCatalog.tierRank(targetTier) <= SubscriptionPlanCatalog.tierRank(current)) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "NOT_AN_UPGRADE",
                        "Choose a higher plan than " + current.name() + " for an upgrade.");
            }
            BigDecimal oldMonthly = tenant.getMonthlyPrice() != null
                    ? tenant.getMonthlyPrice()
                    : SubscriptionPlanCatalog.plan(current).monthlyPrice();
            quoted = SubscriptionPlanCatalog.proratedUpgradeAmount(
                    oldMonthly, SubscriptionPlanCatalog.plan(targetTier).monthlyPrice(), today, expiry);
        }

        TenantBillingRequest row = new TenantBillingRequest();
        row.setHotelId(hotelId);
        row.setRequestType(type);
        row.setTargetTier(targetTier);
        row.setMonths(months);
        row.setQuotedAmount(quoted);
        row.setCurrency(tenant.getHotel().getCurrency());
        row.setPaymentReference(trimOrNull(request.paymentReference()));
        row.setNote(trimOrNull(request.note()));
        row.setStatus(TenantBillingRequestStatus.PENDING);
        row.setRequestedBy(actor.getId());
        row.setRequestedAt(Instant.now(clock));
        tenantBillingRequestRepository.save(row);

        auditSubscription(
                hotelId,
                TenantSubscriptionAuditAction.BILLING_REQUEST,
                tenant.getBillingStatus(),
                tenant.getBillingStatus(),
                actor.getId(),
                type.name() + " request quoted " + quoted + " " + row.getCurrency(),
                tenant.getSubscriptionEnd(),
                tenant.getSubscriptionEnd());
        return toSubscriptionStatusResponse(tenant);
    }

    @Transactional(readOnly = true)
    public List<PlatformDtos.BillingRequestRow> listPendingBillingRequests() {
        return tenantBillingRequestRepository
                .findByStatusOrderByRequestedAtDesc(TenantBillingRequestStatus.PENDING)
                .stream()
                .map(this::toBillingRequestRow)
                .toList();
    }

    @Transactional
    public PlatformDtos.TenantSubscriptionStatusResponse resolveBillingRequest(
            UUID requestId, PlatformDtos.ResolveBillingRequest body) {
        TenantBillingRequest req = tenantBillingRequestRepository
                .findById(requestId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Billing request not found"));
        if (req.getStatus() != TenantBillingRequestStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "Billing request is already resolved");
        }
        UserPrincipal actor = tenantAccessService.currentUser();
        if (!body.approve()) {
            req.setStatus(TenantBillingRequestStatus.REJECTED);
            req.setResolvedBy(actor.getId());
            req.setResolvedAt(Instant.now(clock));
            req.setResolveNote(trimOrNull(body.note()));
            tenantBillingRequestRepository.save(req);
            return subscriptionStatus(req.getHotelId());
        }

        PlatformDtos.TenantSubscriptionStatusResponse result;
        if (req.getRequestType() == TenantBillingRequestType.RENEW) {
            int months = body.months() != null ? body.months() : (req.getMonths() != null ? req.getMonths() : 1);
            result = renewSubscription(
                    req.getHotelId(),
                    new PlatformDtos.RenewTenantSubscriptionRequest(
                            months,
                            body.amount() != null ? body.amount() : req.getQuotedAmount(),
                            body.currency() != null ? body.currency() : req.getCurrency(),
                            body.paymentReference() != null ? body.paymentReference() : req.getPaymentReference(),
                            body.note() != null ? body.note() : req.getNote()));
        } else {
            result = changePlan(
                    req.getHotelId(),
                    new PlatformDtos.ChangePlanRequest(
                            req.getTargetTier().name(),
                            body.amount() != null ? body.amount() : req.getQuotedAmount(),
                            body.currency() != null ? body.currency() : req.getCurrency(),
                            body.paymentReference() != null ? body.paymentReference() : req.getPaymentReference(),
                            body.note() != null ? body.note() : req.getNote()));
        }
        req.setStatus(TenantBillingRequestStatus.APPROVED);
        req.setResolvedBy(actor.getId());
        req.setResolvedAt(Instant.now(clock));
        req.setResolveNote(trimOrNull(body.note()));
        tenantBillingRequestRepository.save(req);
        return result;
    }

    @Transactional
    public PlatformDtos.TenantSubscriptionStatusResponse updateSubscriptionSettings(
            UUID tenantId, PlatformDtos.UpdateTenantSubscriptionSettingsRequest request) {
        UserPrincipal actor = tenantAccessService.currentUser();
        PlatformTenant tenant = mustTenant(tenantId);
        PlatformBillingStatus previous = tenant.getBillingStatus();
        Instant oldExpiry = tenant.getSubscriptionEnd();

        if (request.monthlyPrice() != null) {
            if (request.monthlyPrice().compareTo(BigDecimal.ZERO) < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MONTHLY_PRICE", "Monthly price cannot be negative.");
            }
            tenant.setMonthlyPrice(request.monthlyPrice().setScale(2, RoundingMode.HALF_UP));
        }
        if (request.subscriptionEndDate() != null) {
            tenant.setSubscriptionEnd(request.subscriptionEndDate().atStartOfDay(ZoneOffset.UTC).toInstant());
            if (tenant.getSubscriptionStart() == null) {
                tenant.setSubscriptionStart(LocalDate.now(clock).atStartOfDay(ZoneOffset.UTC).toInstant());
            }
        }
        if (!tenant.isManuallyBlocked()) {
            LocalDate today = LocalDate.now(clock);
            LocalDate expiry = tenant.getSubscriptionEnd() != null
                    ? LocalDate.ofInstant(tenant.getSubscriptionEnd(), ZoneOffset.UTC)
                    : null;
            if (expiry == null || expiry.isBefore(today)) {
                tenant.setBillingStatus(PlatformBillingStatus.EXPIRED);
                tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.SUSPENDED);
            } else {
                tenant.setBillingStatus(
                        ChronoUnit.DAYS.between(today, expiry) <= SubscriptionStateResolver.EXPIRING_SOON_DAYS
                                ? PlatformBillingStatus.EXPIRING_SOON
                                : PlatformBillingStatus.ACTIVE);
                tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.ACTIVE);
            }
        }
        platformTenantRepository.save(tenant);
        auditSubscription(
                tenantId,
                TenantSubscriptionAuditAction.SETTINGS_UPDATE,
                previous,
                tenant.getBillingStatus(),
                actor.getId(),
                request.note(),
                oldExpiry,
                tenant.getSubscriptionEnd());
        tenantSubscriptionGuard.evict(tenantId);
        return toSubscriptionStatusResponse(tenant);
    }

    @Transactional
    public PlatformDtos.TenantSubscriptionStatusResponse manuallyBlock(
            UUID tenantId, PlatformDtos.ManualBlockTenantRequest request) {
        UserPrincipal actor = tenantAccessService.currentUser();
        PlatformTenant tenant = mustTenant(tenantId);
        PlatformBillingStatus previous = tenant.getBillingStatus();
        tenant.setManuallyBlocked(true);
        tenant.setManualBlockReason(request.reason().trim());
        tenant.setBlockedBy(actor.getId());
        tenant.setBlockedAt(Instant.now(clock));
        tenant.setBillingStatus(PlatformBillingStatus.MANUALLY_BLOCKED);
        tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.SUSPENDED);
        platformTenantRepository.save(tenant);
        auditSubscription(
                tenantId,
                TenantSubscriptionAuditAction.MANUAL_BLOCK,
                previous,
                tenant.getBillingStatus(),
                actor.getId(),
                request.reason(),
                tenant.getSubscriptionEnd(),
                tenant.getSubscriptionEnd());
        tenantSubscriptionGuard.evict(tenantId);
        return toSubscriptionStatusResponse(tenant);
    }

    @Transactional
    public PlatformDtos.TenantSubscriptionStatusResponse manuallyUnblock(
            UUID tenantId, PlatformDtos.ManualUnblockTenantRequest request) {
        UserPrincipal actor = tenantAccessService.currentUser();
        PlatformTenant tenant = mustTenant(tenantId);
        SubscriptionState state = subscriptionStateResolver.resolve(tenant);
        if (state.status() == PlatformBillingStatus.EXPIRED || state.daysRemaining() < 0) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "RENEWAL_REQUIRED",
                    "Expired tenants cannot be unblocked without subscription renewal.");
        }
        PlatformBillingStatus previous = tenant.getBillingStatus();
        tenant.setManuallyBlocked(false);
        tenant.setManualBlockReason(null);
        tenant.setBlockedBy(null);
        tenant.setBlockedAt(null);
        tenant.setBillingStatus(state.daysRemaining() <= SubscriptionStateResolver.EXPIRING_SOON_DAYS
                ? PlatformBillingStatus.EXPIRING_SOON
                : PlatformBillingStatus.ACTIVE);
        tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.ACTIVE);
        platformTenantRepository.save(tenant);
        auditSubscription(
                tenantId,
                TenantSubscriptionAuditAction.MANUAL_UNBLOCK,
                previous,
                tenant.getBillingStatus(),
                actor.getId(),
                request != null ? request.note() : null,
                tenant.getSubscriptionEnd(),
                tenant.getSubscriptionEnd());
        tenantSubscriptionGuard.evict(tenantId);
        return toSubscriptionStatusResponse(tenant);
    }

    @Transactional
    public Map<String, Object> onboardTenant(PlatformDtos.CreatePlatformTenantRequest body, HttpServletRequest request) {
        UserPrincipal actor = tenantAccessService.currentUser();
        if (actor.getRole() != Role.SUPER_ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Super admin only");
        }
        ApiDtos.HotelCreateInput hotelIn = new ApiDtos.HotelCreateInput(
                body.hotel().name().trim(),
                body.hotel().code().trim().toUpperCase(),
                body.hotel().timezone(),
                body.hotel().currency(),
                "ACTIVE",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
        Hotel hotel = hotelProvisioningService.createHotel(hotelIn);
        PlatformTenant pt = platformTenantRepository
                .findById(hotel.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Platform tenant not provisioned"));

        pt.setProvisioningStatus(ProvisioningStatus.PROVISIONING);
        platformTenantRepository.save(pt);

        SubscriptionTier tier = SubscriptionTier.valueOf(body.subscription().tier().trim().toUpperCase());
        PlatformBillingCycle cycle =
                PlatformBillingCycle.valueOf(body.subscription().billingCycle().trim().toUpperCase());
        pt.setTier(tier);
        pt.setBillingCycle(cycle);
        LocalDate start =
                body.subscription().startDate() != null && !body.subscription().startDate().isBlank()
                        ? LocalDate.parse(body.subscription().startDate())
                        : LocalDate.now(clock);
        pt.setSubscriptionStart(start.atStartOfDay(ZoneOffset.UTC).toInstant());
        if (cycle == PlatformBillingCycle.ANNUAL) {
            pt.setSubscriptionEnd(start.plusYears(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        } else {
            pt.setSubscriptionEnd(start.plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant());
        }
        applyTierDefaults(pt, tier, body.subscription().customLimits());
        if (body.provisioning() != null && body.provisioning().enableFeatures() != null) {
            List<String> f = body.provisioning().enableFeatures();
            pt.setFeaturesAdvancedReporting(f.stream().anyMatch(x -> x.equalsIgnoreCase("advanced_reporting")));
            pt.setFeaturesChannelManager(f.stream().anyMatch(x -> x.equalsIgnoreCase("channel_manager")));
            pt.setFeaturesMobileApp(f.stream().anyMatch(x -> x.equalsIgnoreCase("mobile_app")));
        }
        if (body.hotel().contact() != null) {
            pt.setContactEmail(body.hotel().contact().adminEmail());
            pt.setContactPhone(body.hotel().contact().phone());
        }
        if (body.billing() != null) {
            if (body.billing().stripeCustomerId() != null && !body.billing().stripeCustomerId().isBlank()) {
                pt.setStripeCustomerId(body.billing().stripeCustomerId().trim());
            }
            if (body.billing().paymentMethod() != null && !body.billing().paymentMethod().isBlank()) {
                pt.setPaymentMethodId(body.billing().paymentMethod().trim());
            }
        }
        pt.setHotelName(hotel.getName());
        pt.setProvisioningStatus(ProvisioningStatus.PROVISIONED);
        platformTenantRepository.save(pt);

        String tempPassword = generateTempPassword();
        String adminUsername = resolveAdminUsername(body.hotel().contact(), hotel.getCode());
        String candidate = adminUsername;
        int n = 0;
        while (appUserRepository.findByUsername(candidate).isPresent()) {
            candidate = adminUsername + "_" + (++n);
        }
        adminUsername = candidate;
        AppUser admin = new AppUser();
        admin.setUsername(adminUsername);
        if (body.hotel().contact() != null && body.hotel().contact().adminEmail() != null) {
            String em = body.hotel().contact().adminEmail().trim();
            if (!em.isEmpty()) {
                admin.setEmail(em);
            }
        }
        admin.setPasswordHash(passwordEncoder.encode(tempPassword));
        admin.setRole(Role.HOTEL_ADMIN);
        admin.setHotel(hotel);
        appUserRepository.save(admin);

        provisioningJobService.enqueue(hotel.getId(), ProvisioningJobType.CREATE_TENANT_SCHEMA, Map.of());
        Map<String, Object> stripePayload = new LinkedHashMap<>();
        if (pt.getContactEmail() != null && !pt.getContactEmail().isBlank()) {
            stripePayload.put("email", pt.getContactEmail());
        }
        stripePayload.put("name", pt.getHotelName());
        provisioningJobService.enqueue(hotel.getId(), ProvisioningJobType.STRIPE_CUSTOMER_SYNC, stripePayload);
        provisioningJobService.enqueue(
                hotel.getId(),
                ProvisioningJobType.NOTIFY_WELCOME,
                Map.of("adminUsername", adminUsername, "tenantId", hotel.getId().toString()));

        List<Map<String, Object>> steps = List.of(
                Map.of(
                        "step",
                        "CREATE_DATABASE_SCHEMA",
                        "status",
                        multitenancyProperties.isSchemaIsolationEnabled() ? "QUEUED" : "SKIPPED",
                        "timestamp",
                        Instant.now(clock).toString()),
                Map.of("step", "STRIPE_CUSTOMER_SYNC", "status", "QUEUED", "timestamp", Instant.now(clock).toString()),
                Map.of("step", "SEED_REFERENCE_DATA", "status", "SKIPPED", "timestamp", Instant.now(clock).toString()),
                Map.of("step", "CREATE_ADMIN_USER", "status", "COMPLETED", "timestamp", Instant.now(clock).toString()),
                Map.of("step", "CONFIGURE_FEATURE_FLAGS", "status", "COMPLETED", "timestamp", Instant.now(clock).toString()));

        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("tenantId", hotel.getId().toString());
        changes.put("adminUsername", adminUsername);
        auditRecord(actor.getId(), "TENANT_CREATED", hotel.getId(), changes, request);

        Map<String, Object> adminCreds = new LinkedHashMap<>();
        adminCreds.put("temporaryPassword", tempPassword);
        adminCreds.put("passwordResetRequired", true);
        adminCreds.put("setupUrl", "https://" + pt.getSubdomain() + ".yourhms.com/setup?token=demo");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tenantId", hotel.getId().toString());
        out.put("status", "PROVISIONING");
        out.put(
                "hotel",
                Map.of(
                        "id",
                        hotel.getId().toString(),
                        "name",
                        hotel.getName(),
                        "subdomain",
                        pt.getSubdomain(),
                        "adminCredentials",
                        adminCreds));
        out.put(
                "subscription",
                Map.of(
                        "id",
                        UUID.randomUUID().toString(),
                        "tier",
                        pt.getTier().name(),
                        "status",
                        pt.getBillingStatus().name(),
                        "nextBillingDate",
                        pt.getSubscriptionEnd() != null
                                ? LocalDate.ofInstant(pt.getSubscriptionEnd(), ZoneOffset.UTC).toString()
                                : null,
                        "amount",
                        pt.getMonthlyPrice()));
        out.put("provisioningSteps", steps);
        out.put(
                "nextActions",
                List.of(
                        "Share setup URL with hotel admin",
                        "Monitor provisioning: GET /api/v1/platform/tenants/{id}/dashboard",
                        "Send welcome email"));
        out.put(
                "webhook",
                Map.of(
                        "provisioningComplete",
                        "https://your-crm.com/webhooks/hms-tenant-ready",
                        "payload",
                        Map.of("tenantId", hotel.getId().toString(), "subdomain", pt.getSubdomain())));
        return out;
    }

    private static String generateTempPassword() {
        int n = 100000 + RANDOM.nextInt(900000);
        return "TempPass#" + n;
    }

    private static String resolveAdminUsername(PlatformDtos.HotelContactInput contact, String hotelCode) {
        if (contact == null || contact.adminEmail() == null || contact.adminEmail().isBlank()) {
            return "admin_" + hotelCode.toLowerCase();
        }
        String base = contact.adminEmail().trim().toLowerCase();
        return base;
    }

    private void applyTierDefaults(PlatformTenant pt, SubscriptionTier tier, PlatformDtos.SubscriptionCustomLimits custom) {
        SubscriptionPlanCatalog.PlanDefinition def = SubscriptionPlanCatalog.plan(tier);
        pt.setMaxRooms(custom != null && custom.maxRooms() != null ? custom.maxRooms() : def.maxRooms());
        pt.setMaxUsers(custom != null && custom.maxUsers() != null ? custom.maxUsers() : def.maxUsers());
        pt.setMaxReservationsPerMonth(
                custom != null && custom.maxReservationsPerMonth() != null
                        ? custom.maxReservationsPerMonth()
                        : def.maxReservationsPerMonth());
        pt.setMonthlyPrice(def.monthlyPrice());
    }

    @Transactional
    public PlatformDtos.ImpersonationResponse impersonate(
            UUID tenantId, PlatformDtos.ImpersonateRequest body, HttpServletRequest request) {
        UserPrincipal actor = tenantAccessService.currentUser();
        PlatformTenant tenant = platformTenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tenant not found"));
        if (tenant.getProvisioningStatus() != ProvisioningStatus.PROVISIONED) {
            throw new ApiException(HttpStatus.CONFLICT, "Cannot impersonate tenant in this provisioning state");
        }
        UUID sessionId = UUID.randomUUID();
        int duration = body.duration() > 0 ? body.duration() : 60;
        List<String> blocked = body.restrictActions() != null ? body.restrictActions() : List.of();
        String token = jwtService.generateImpersonationToken(sessionId, actor.getId(), tenantId, duration, blocked);
        Instant exp = Instant.now(clock).plusSeconds(Math.min(duration, 120) * 60L);

        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("reason", body.reason());
        changes.put("durationMinutes", duration);
        PlatformAuditLog saved = auditRecord(actor.getId(), "IMPERSONATE_TENANT", tenantId, changes, request);

        Map<String, Object> restrictions = Map.of(
                "blockedActions",
                blocked.isEmpty() ? List.of() : blocked,
                "auditLogging",
                "ENHANCED");
        Map<String, Object> notification = Map.of(
                "sent",
                Boolean.TRUE.equals(body.notifyTenant()),
                "recipient",
                tenant.getContactEmail() != null ? tenant.getContactEmail() : "",
                "message",
                "Platform support impersonation window (demo)");
        Map<String, Object> usage = new LinkedHashMap<>();
        usage.put("authorization", "Bearer <super_admin_session_jwt>");
        usage.put("impersonationHeader", JwtAuthenticationFilter.IMPERSONATE_HEADER + ": " + token);
        usage.put(
                "note",
                "Send super-admin Bearer plus X-Impersonate-Token for hotel-scoped APIs, or use the impersonation JWT alone as Authorization Bearer.");
        Map<String, Object> auditMap =
                Map.of("logId", saved.getId().toString(), "viewUrl", "/api/v1/platform/audit/logs?tenantId=" + tenantId);
        return new PlatformDtos.ImpersonationResponse(
                sessionId.toString(),
                tenantId.toString(),
                token,
                exp.toString(),
                restrictions,
                notification,
                usage,
                auditMap);
    }

    /**
     * Persists a row in {@code platform_audit_logs} for cross-hotel / console activity (super admin sign-in,
     * tenant onboarding, impersonation, etc.). {@code targetTenantId} may be null when the event is not scoped to
     * one tenant.
     */
    @Transactional
    public void recordCrossPlatformAudit(
            UUID actorUserId,
            String action,
            UUID targetTenantId,
            Map<String, Object> changes,
            HttpServletRequest request) {
        auditRecord(
                actorUserId,
                action,
                targetTenantId,
                changes != null ? changes : Map.of(),
                request);
    }

    private PlatformAuditLog auditRecord(UUID actorId, String action, UUID tenantId, Map<String, Object> changes, HttpServletRequest req) {
        PlatformAuditLog log = new PlatformAuditLog();
        log.setActorUserId(actorId);
        log.setAction(action);
        log.setTargetTenantId(tenantId);
        try {
            log.setChangesJson(objectMapper.writeValueAsString(changes));
        } catch (JsonProcessingException e) {
            log.setChangesJson("{}");
        }
        if (req != null) {
            log.setIpAddress(clientIp(req));
            log.setUserAgent(req.getHeader("User-Agent"));
        }
        log.setTimestamp(Instant.now(clock));
        return platformAuditLogRepository.save(log);
    }

    private static boolean tenantMatchesSearch(PlatformTenant t, String needle) {
        if (t.getSubdomain() != null && t.getSubdomain().toLowerCase(Locale.ROOT).contains(needle)) {
            return true;
        }
        if (t.getHotelName() != null && t.getHotelName().toLowerCase(Locale.ROOT).contains(needle)) {
            return true;
        }
        return t.getContactEmail() != null && t.getContactEmail().toLowerCase(Locale.ROOT).contains(needle);
    }

    private static String clientIp(HttpServletRequest req) {
        String x = req.getHeader("X-Forwarded-For");
        if (x != null && !x.isBlank()) {
            return x.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> revenueAnalytics(String period, String groupBy) {
        List<PlatformTenant> all = platformTenantRepository.searchByStatusAndTier(null, null);
        BigDecimal mrr = platformTenantRepository.sumActiveMonthlyPrice();
        Map<SubscriptionTier, List<PlatformTenant>> byTier = new HashMap<>();
        for (PlatformTenant t : all) {
            byTier.computeIfAbsent(t.getTier(), k -> new ArrayList<>()).add(t);
        }
        List<Map<String, Object>> tiers = new ArrayList<>();
        for (SubscriptionTier tier : SubscriptionTier.values()) {
            List<PlatformTenant> tierTenants = byTier.getOrDefault(tier, List.of());
            BigDecimal sum = tierTenants.stream()
                    .map(PlatformTenant::getMonthlyPrice)
                    .map(v -> v != null ? v : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            int tierChurnRisk = (int) tierTenants.stream()
                    .filter(t -> t.getBillingStatus() == PlatformBillingStatus.EXPIRING_SOON)
                    .count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("tier", tier.name());
            row.put("tenants", tierTenants.size());
            row.put("mrr", sum.setScale(2, RoundingMode.HALF_UP));
            row.put(
                    "avgRevenuePerTenant",
                    tierTenants.isEmpty()
                            ? BigDecimal.ZERO
                            : sum.divide(BigDecimal.valueOf(tierTenants.size()), 2, RoundingMode.HALF_UP));
            row.put("churnRisk", tierChurnRisk);
            tiers.add(row);
        }
        YearMonth cur = YearMonth.now(clock);
        YearMonth prev = cur.minusMonths(1);
        Map<String, Object> periodMap = Map.of(
                "type",
                period != null && !period.isBlank() ? period : "monthly",
                "current",
                cur.toString(),
                "previous",
                prev.toString());
        BigDecimal arr = mrr.multiply(BigDecimal.valueOf(12)).setScale(2, RoundingMode.HALF_UP);
        Map<String, Object> revenue = new LinkedHashMap<>();
        revenue.put("mrr", mrr.setScale(2, RoundingMode.HALF_UP));
        revenue.put("mrrGrowth", "n/a");
        revenue.put("arr", arr);
        revenue.put("ltv", BigDecimal.ZERO);
        revenue.put("churnRate", BigDecimal.ZERO);
        Map<String, Object> usage = Map.of(
                "totalApiCalls",
                0,
                "storageUsed",
                "n/a",
                "avgUptime",
                99.97,
                "supportTickets",
                Map.of("open", 0, "resolved", 0, "avgResolutionTime", "n/a"));
        Map<String, String> export = Map.of(
                "financialReport", "/api/v1/platform/analytics/revenue/export?format=pdf",
                "tenantList", "/api/v1/platform/tenants/export?format=csv");
        return Map.of(
                "period",
                periodMap,
                "revenue",
                revenue,
                "byTier",
                tiers,
                "usage",
                usage,
                "alerts",
                List.of(),
                "exportOptions",
                export);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> subscriptionAnalytics() {
        List<PlatformTenant> tenants = platformTenantRepository.searchByStatusAndTier(null, null);
        List<TenantPaymentRecord> payments = tenantPaymentRecordRepository.findAll();
        BigDecimal collected = payments.stream()
                .map(TenantPaymentRecord::getAmount)
                .map(v -> v != null ? v : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal monthlyDue = tenants.stream()
                .map(PlatformTenant::getMonthlyPrice)
                .map(v -> v != null ? v : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long expiringSoon = tenants.stream()
                .filter(t -> subscriptionStateResolver.resolve(t).status() == PlatformBillingStatus.EXPIRING_SOON)
                .count();
        long expired = tenants.stream()
                .filter(t -> subscriptionStateResolver.resolve(t).status() == PlatformBillingStatus.EXPIRED)
                .count();
        long manuallyBlocked = tenants.stream().filter(PlatformTenant::isManuallyBlocked).count();
        List<Map<String, Object>> due = tenants.stream()
                .map(t -> {
                    SubscriptionState state = subscriptionStateResolver.resolve(t);
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("hotelId", t.getHotel().getId().toString());
                    row.put("hotelName", t.getHotelName() != null ? t.getHotelName() : t.getHotel().getName());
                    row.put("status", state.status().name());
                    row.put("tier", t.getTier() != null ? t.getTier().name() : SubscriptionTier.STARTER.name());
                    row.put("daysRemaining", state.daysRemaining() == Long.MAX_VALUE ? "n/a" : state.daysRemaining());
                    row.put("expiryDate", state.expiryDate() != null ? state.expiryDate().toString() : "");
                    row.put("monthlyPrice", t.getMonthlyPrice() != null ? t.getMonthlyPrice() : BigDecimal.ZERO);
                    return row;
                })
                .sorted((a, b) -> {
                    int rank = statusRank(String.valueOf(a.get("status"))) - statusRank(String.valueOf(b.get("status")));
                    if (rank != 0) return rank;
                    return String.valueOf(a.get("hotelName")).compareToIgnoreCase(String.valueOf(b.get("hotelName")));
                })
                .toList();
        List<Map<String, Object>> recentPayments = payments.stream()
                .sorted((a, b) -> b.getConfirmedAt().compareTo(a.getConfirmedAt()))
                .limit(10)
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("hotelId", p.getHotelId().toString());
                    m.put("monthsPaid", p.getMonthsPaid());
                    m.put("amount", p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO);
                    m.put("currency", p.getCurrency() != null ? p.getCurrency() : "");
                    m.put("paymentReference", p.getPaymentReference() != null ? p.getPaymentReference() : "");
                    m.put("confirmedAt", p.getConfirmedAt().toString());
                    m.put("note", p.getNote() != null ? p.getNote() : "");
                    return m;
                })
                .toList();
        List<Map<String, Object>> pendingBillingRequests = listPendingBillingRequests().stream()
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", r.id().toString());
                    m.put("hotelId", r.hotelId().toString());
                    m.put("hotelName", r.hotelName());
                    m.put("requestType", r.requestType());
                    m.put("targetTier", r.targetTier());
                    m.put("months", r.months());
                    m.put("quotedAmount", r.quotedAmount());
                    m.put("currency", r.currency());
                    m.put("paymentReference", r.paymentReference());
                    m.put("note", r.note());
                    m.put("requestedAt", r.requestedAt() != null ? r.requestedAt().toString() : null);
                    return m;
                })
                .toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(
                "summary",
                Map.of(
                        "totalCollected", collected.setScale(2, RoundingMode.HALF_UP),
                        "monthlyDue", monthlyDue.setScale(2, RoundingMode.HALF_UP),
                        "expiringSoon", expiringSoon,
                        "expired", expired,
                        "manuallyBlocked", manuallyBlocked,
                        "tenantCount", tenants.size(),
                        "pendingBillingRequests", pendingBillingRequests.size()));
        out.put("dueTenants", due);
        out.put("recentPayments", recentPayments);
        out.put("pendingBillingRequests", pendingBillingRequests);
        return out;
    }

    private static int statusRank(String status) {
        return switch (status) {
            case "EXPIRED" -> 0;
            case "MANUALLY_BLOCKED" -> 1;
            case "EXPIRING_SOON" -> 2;
            case "ACTIVE" -> 3;
            default -> 4;
        };
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> auditLogs(UUID tenantIdFilter) {
        List<PlatformAuditLog> logs =
                tenantIdFilter == null
                        ? platformAuditLogRepository.findTop200ByOrderByTimestampDesc()
                        : platformAuditLogRepository.findTop200ByTargetTenantIdOrderByTimestampDesc(tenantIdFilter);
        List<Map<String, Object>> out = new ArrayList<>();
        for (PlatformAuditLog l : logs) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", l.getId().toString());
            m.put("actorUserId", l.getActorUserId() != null ? l.getActorUserId().toString() : null);
            m.put("action", l.getAction());
            m.put("targetTenantId", l.getTargetTenantId() != null ? l.getTargetTenantId().toString() : null);
            m.put("targetResourceId", l.getTargetResourceId() != null ? l.getTargetResourceId().toString() : null);
            m.put("changes", l.getChangesJson());
            m.put("ipAddress", l.getIpAddress());
            m.put("timestamp", l.getTimestamp().toString());
            m.put("notes", l.getNotes());
            out.add(m);
        }
        return out;
    }

    private PlatformTenant mustTenant(UUID tenantId) {
        return platformTenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant not found"));
    }

    private PlatformDtos.TenantSubscriptionStatusResponse toSubscriptionStatusResponse(PlatformTenant tenant) {
        SubscriptionState state = subscriptionStateResolver.resolve(tenant);
        LocalDate today = LocalDate.now(clock);
        LocalDate expiry = state.expiryDate();
        SubscriptionTier current = tenant.getTier() != null ? tenant.getTier() : SubscriptionTier.STARTER;
        BigDecimal monthly = tenant.getMonthlyPrice() != null
                ? tenant.getMonthlyPrice()
                : SubscriptionPlanCatalog.plan(current).monthlyPrice();

        List<PlatformDtos.SubscriptionPlanOption> plans = SubscriptionPlanCatalog.allPlans().values().stream()
                .map(p -> new PlatformDtos.SubscriptionPlanOption(
                        p.tier().name(),
                        p.label(),
                        p.monthlyPrice(),
                        p.maxRooms(),
                        p.maxUsers(),
                        p.maxReservationsPerMonth()))
                .toList();

        List<PlatformDtos.RenewQuote> renewQuotes = List.of(1, 3, 6, 12).stream()
                .map(months -> {
                    LocalDate base = expiry != null && expiry.isAfter(today) ? expiry : today;
                    return new PlatformDtos.RenewQuote(
                            months,
                            SubscriptionPlanCatalog.renewAmount(monthly, months),
                            base.plusMonths(months));
                })
                .toList();

        List<PlatformDtos.UpgradeQuote> upgradeQuotes = new ArrayList<>();
        for (SubscriptionPlanCatalog.PlanDefinition plan : SubscriptionPlanCatalog.allPlans().values()) {
            if (SubscriptionPlanCatalog.tierRank(plan.tier()) <= SubscriptionPlanCatalog.tierRank(current)) {
                continue;
            }
            BigDecimal due = SubscriptionPlanCatalog.proratedUpgradeAmount(
                    monthly, plan.monthlyPrice(), today, expiry != null ? expiry : today);
            long daysLeft = expiry != null && expiry.isAfter(today) ? ChronoUnit.DAYS.between(today, expiry) : 0;
            upgradeQuotes.add(new PlatformDtos.UpgradeQuote(
                    plan.tier().name(),
                    plan.label(),
                    plan.monthlyPrice(),
                    due,
                    daysLeft,
                    daysLeft > 0
                            ? "Prorated upgrade for remaining " + daysLeft + " days; expiry stays the same."
                            : "No active period remaining — renew first, then upgrade."));
        }

        List<PlatformDtos.BillingRequestRow> pending = tenantBillingRequestRepository
                .findByHotelIdOrderByRequestedAtDesc(tenant.getHotel().getId())
                .stream()
                .filter(r -> r.getStatus() == TenantBillingRequestStatus.PENDING)
                .map(this::toBillingRequestRow)
                .toList();

        return new PlatformDtos.TenantSubscriptionStatusResponse(
                tenant.getHotel().getId(),
                tenant.getHotelName(),
                state.status().name(),
                current.name(),
                tenant.getSubscriptionStart() != null
                        ? LocalDate.ofInstant(tenant.getSubscriptionStart(), ZoneOffset.UTC)
                        : null,
                state.expiryDate(),
                state.daysRemaining() == Long.MAX_VALUE ? null : state.daysRemaining(),
                state.blocked(),
                tenant.isManuallyBlocked(),
                tenant.getManualBlockReason(),
                tenant.getBlockedAt(),
                tenant.getBlockedBy(),
                tenant.getLastPaymentConfirmedAt(),
                monthly,
                tenant.getHotel().getCurrency(),
                plans,
                renewQuotes,
                upgradeQuotes,
                pending);
    }

    private PlatformDtos.BillingRequestRow toBillingRequestRow(TenantBillingRequest row) {
        String hotelName = platformTenantRepository
                .findById(row.getHotelId())
                .map(t -> t.getHotelName() != null ? t.getHotelName() : t.getHotel().getName())
                .orElse("Hotel");
        return new PlatformDtos.BillingRequestRow(
                row.getId(),
                row.getHotelId(),
                hotelName,
                row.getRequestType().name(),
                row.getTargetTier() != null ? row.getTargetTier().name() : null,
                row.getMonths(),
                row.getQuotedAmount(),
                row.getCurrency(),
                row.getPaymentReference(),
                row.getNote(),
                row.getStatus().name(),
                row.getRequestedAt());
    }

    private static SubscriptionTier parseTierRequired(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TIER_REQUIRED", "Subscription tier is required");
        }
        try {
            return SubscriptionTier.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIER", "Unknown subscription tier");
        }
    }

    private void auditSubscription(
            UUID hotelId,
            TenantSubscriptionAuditAction action,
            PlatformBillingStatus previous,
            PlatformBillingStatus next,
            UUID actorId,
            String note,
            Instant oldExpiry,
            Instant newExpiry) {
        TenantSubscriptionAudit row = new TenantSubscriptionAudit();
        row.setHotelId(hotelId);
        row.setAction(action);
        row.setPreviousStatus(previous);
        row.setNewStatus(next);
        row.setActorId(actorId);
        row.setNote(trimOrNull(note));
        row.setOldExpiry(oldExpiry);
        row.setNewExpiry(newExpiry);
        row.setCreatedAt(Instant.now(clock));
        tenantSubscriptionAuditRepository.save(row);
    }

    private static String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String trimOrDefault(String value, String fallback) {
        String trimmed = trimOrNull(value);
        return trimmed != null ? trimmed : fallback;
    }

    private static PlatformBillingStatus parseBillingStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase();
        if ("PAST_DUE".equals(normalized)) {
            return PlatformBillingStatus.EXPIRING_SOON;
        }
        if ("SUSPENDED".equals(normalized)) {
            return PlatformBillingStatus.EXPIRED;
        }
        return PlatformBillingStatus.valueOf(normalized);
    }

    private static SubscriptionTier parseTier(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return SubscriptionTier.valueOf(raw.trim().toUpperCase());
    }
}
