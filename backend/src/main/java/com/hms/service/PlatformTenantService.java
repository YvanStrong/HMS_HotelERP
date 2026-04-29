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
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.entity.PlatformAuditLog;
import com.hms.entity.PlatformTenant;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.PlatformAuditLogRepository;
import com.hms.repository.PlatformTenantRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomRepository;
import com.hms.security.JwtAuthenticationFilter;
import com.hms.security.JwtService;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
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
            HmsMultitenancyProperties multitenancyProperties) {
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
        BigDecimal mrr = platformTenantRepository.sumActiveMonthlyPrice();
        int churnRisk = 0;
        int active = 0;
        for (PlatformTenant t : rows) {
            if (t.getBillingStatus() == PlatformBillingStatus.ACTIVE) {
                active++;
            }
            Map<String, Object> row = toTenantRow(t);
            boolean highUsage = Boolean.TRUE.equals(row.remove("_highUsage"));
            data.add(row);
            if (t.getBillingStatus() == PlatformBillingStatus.PAST_DUE || highUsage) {
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
        YearMonth ym = YearMonth.now(ZoneOffset.UTC);
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

        Map<String, Object> subscription = new LinkedHashMap<>();
        subscription.put("tier", t.getTier().name());
        subscription.put("status", t.getBillingStatus().name());
        subscription.put("billingCycle", t.getBillingCycle().name());
        subscription.put(
                "nextBillingDate",
                t.getSubscriptionEnd() != null
                        ? LocalDate.ofInstant(t.getSubscriptionEnd(), ZoneOffset.UTC).toString()
                        : null);
        subscription.put("monthlyPrice", t.getMonthlyPrice());

        Map<String, Object> health = Map.of(
                "uptime", 99.98,
                "lastBackup",
                Instant.now().truncatedTo(ChronoUnit.HOURS).toString(),
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
                        : LocalDate.now(ZoneOffset.UTC);
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
                        Instant.now().toString()),
                Map.of("step", "STRIPE_CUSTOMER_SYNC", "status", "QUEUED", "timestamp", Instant.now().toString()),
                Map.of("step", "SEED_REFERENCE_DATA", "status", "SKIPPED", "timestamp", Instant.now().toString()),
                Map.of("step", "CREATE_ADMIN_USER", "status", "COMPLETED", "timestamp", Instant.now().toString()),
                Map.of("step", "CONFIGURE_FEATURE_FLAGS", "status", "COMPLETED", "timestamp", Instant.now().toString()));

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
        int defRooms =
                switch (tier) {
                    case STARTER -> 50;
                    case PROFESSIONAL -> 150;
                    case ENTERPRISE -> 9999;
                };
        int defUsers =
                switch (tier) {
                    case STARTER -> 10;
                    case PROFESSIONAL -> 50;
                    case ENTERPRISE -> 500;
                };
        int defRes =
                switch (tier) {
                    case STARTER -> 500;
                    case PROFESSIONAL -> 5000;
                    case ENTERPRISE -> 100000;
                };
        BigDecimal price =
                switch (tier) {
                    case STARTER -> new BigDecimal("99.00");
                    case PROFESSIONAL -> new BigDecimal("299.00");
                    case ENTERPRISE -> new BigDecimal("999.00");
                };
        pt.setMaxRooms(custom != null && custom.maxRooms() != null ? custom.maxRooms() : defRooms);
        pt.setMaxUsers(custom != null && custom.maxUsers() != null ? custom.maxUsers() : defUsers);
        pt.setMaxReservationsPerMonth(
                custom != null && custom.maxReservationsPerMonth() != null ? custom.maxReservationsPerMonth() : defRes);
        pt.setMonthlyPrice(price);
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
        Instant exp = Instant.now().plusSeconds(Math.min(duration, 120) * 60L);

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
        log.setTimestamp(Instant.now());
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
                    .filter(t -> t.getBillingStatus() == PlatformBillingStatus.PAST_DUE)
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
        YearMonth cur = YearMonth.now(ZoneOffset.UTC);
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

    private static PlatformBillingStatus parseBillingStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return PlatformBillingStatus.valueOf(raw.trim().toUpperCase());
    }

    private static SubscriptionTier parseTier(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return SubscriptionTier.valueOf(raw.trim().toUpperCase());
    }
}
