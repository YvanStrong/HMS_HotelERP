package com.hms.service;

import com.hms.domain.Role;
import com.hms.domain.TenantSubscriptionAuditAction;
import com.hms.entity.AppUser;
import com.hms.entity.PlatformTenant;
import com.hms.entity.TenantSubscriptionAudit;
import com.hms.repository.PlatformTenantRepository;
import com.hms.repository.TenantSubscriptionAuditRepository;
import com.hms.security.UserPrincipal;
import com.hms.web.SubscriptionAccessException;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantSubscriptionGuard {

    private static final long CACHE_TTL_MILLIS = 30_000;

    private final PlatformTenantRepository platformTenantRepository;
    private final TenantSubscriptionAuditRepository auditRepository;
    private final SubscriptionStateResolver stateResolver;
    private final Clock clock;
    private final Map<UUID, CachedState> cache = new ConcurrentHashMap<>();

    public TenantSubscriptionGuard(
            PlatformTenantRepository platformTenantRepository,
            TenantSubscriptionAuditRepository auditRepository,
            SubscriptionStateResolver stateResolver,
            Clock clock) {
        this.platformTenantRepository = platformTenantRepository;
        this.auditRepository = auditRepository;
        this.stateResolver = stateResolver;
        this.clock = clock;
    }

    @Transactional
    public void assertLoginAllowed(AppUser user) {
        UUID hotelId = user.getHotel() != null ? user.getHotel().getId() : null;
        assertAllowed(hotelId, TenantSubscriptionAuditAction.LOGIN_REJECTED, HttpStatus.UNAUTHORIZED, user.getId());
    }

    @Transactional
    public void assertRefreshAllowed(AppUser user) {
        UUID hotelId = user.getHotel() != null ? user.getHotel().getId() : null;
        assertAllowed(hotelId, TenantSubscriptionAuditAction.TOKEN_REJECTED, HttpStatus.UNAUTHORIZED, user.getId());
    }

    @Transactional
    public void assertRequestAllowed(UserPrincipal principal) {
        if (principal == null || principal.getRole() == Role.SUPER_ADMIN) {
            return;
        }
        assertAllowed(principal.getHotelId(), TenantSubscriptionAuditAction.API_ACCESS_REJECTED, HttpStatus.FORBIDDEN, principal.getId());
    }

    @Transactional(readOnly = true)
    public SubscriptionState subscriptionContext(UUID hotelId) {
        return resolveCached(hotelId);
    }

    public void evict(UUID hotelId) {
        if (hotelId != null) {
            cache.remove(hotelId);
        }
    }

    public void evictAll() {
        cache.clear();
    }

    private void assertAllowed(UUID hotelId, TenantSubscriptionAuditAction action, HttpStatus status, UUID actorId) {
        if (hotelId == null) {
            return;
        }
        SubscriptionState state = resolveCached(hotelId);
        if (!state.blocked()) {
            return;
        }
        auditRejected(hotelId, action, state, actorId);
        throw new SubscriptionAccessException(status, state.code(), state.reason(), state.message());
    }

    private SubscriptionState resolveCached(UUID hotelId) {
        if (hotelId == null) {
            return new SubscriptionState(null, Long.MAX_VALUE, false, "PLATFORM_USER", "PLATFORM_USER", "Platform user.", null);
        }
        Instant now = Instant.now(clock);
        CachedState cached = cache.get(hotelId);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.state();
        }
        PlatformTenant tenant = platformTenantRepository.findById(hotelId).orElse(null);
        SubscriptionState state = stateResolver.resolve(tenant);
        cache.put(hotelId, new CachedState(state, now.plusMillis(CACHE_TTL_MILLIS)));
        return state;
    }

    private void auditRejected(UUID hotelId, TenantSubscriptionAuditAction action, SubscriptionState state, UUID actorId) {
        TenantSubscriptionAudit row = new TenantSubscriptionAudit();
        row.setHotelId(hotelId);
        row.setAction(action);
        row.setPreviousStatus(state.status());
        row.setNewStatus(state.status());
        row.setActorId(actorId);
        row.setNote(state.reason() + ": " + state.message());
        row.setCreatedAt(Instant.now(clock));
        auditRepository.save(row);
    }

    private record CachedState(SubscriptionState state, Instant expiresAt) {}
}
