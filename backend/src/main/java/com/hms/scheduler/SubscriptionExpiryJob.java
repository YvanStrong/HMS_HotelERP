package com.hms.scheduler;

import com.hms.domain.PlatformBillingStatus;
import com.hms.domain.SubscriptionStatus;
import com.hms.domain.TenantSubscriptionAuditAction;
import com.hms.entity.PlatformTenant;
import com.hms.entity.TenantSubscriptionAudit;
import com.hms.repository.PlatformTenantRepository;
import com.hms.repository.TenantSubscriptionAuditRepository;
import com.hms.service.SubscriptionStateResolver;
import com.hms.service.TenantSubscriptionGuard;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SubscriptionExpiryJob {

    private static final long LOCK_KEY = 910_202_605_290_001L;

    private final PlatformTenantRepository tenantRepository;
    private final TenantSubscriptionAuditRepository auditRepository;
    private final TenantSubscriptionGuard tenantSubscriptionGuard;
    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    public SubscriptionExpiryJob(
            PlatformTenantRepository tenantRepository,
            TenantSubscriptionAuditRepository auditRepository,
            TenantSubscriptionGuard tenantSubscriptionGuard,
            JdbcTemplate jdbcTemplate,
            Clock clock) {
        this.tenantRepository = tenantRepository;
        this.auditRepository = auditRepository;
        this.tenantSubscriptionGuard = tenantSubscriptionGuard;
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
    }

    @Scheduled(cron = "${hms.subscription.expiry.cron:0 0 * * * *}", zone = "UTC")
    @Transactional
    public void enforceSubscriptionExpiry() {
        if (!tryLock()) {
            return;
        }
        try {
            LocalDate today = LocalDate.now(clock);
            Instant todayStart = today.atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant soon = today.plusDays(SubscriptionStateResolver.EXPIRING_SOON_DAYS)
                    .atStartOfDay(ZoneOffset.UTC)
                    .toInstant();
            for (PlatformTenant tenant : tenantRepository.findTenantsToExpire(todayStart)) {
                PlatformBillingStatus previous = tenant.getBillingStatus();
                tenant.setBillingStatus(PlatformBillingStatus.EXPIRED);
                tenant.setManuallyBlocked(false);
                tenant.getHotel().setSubscriptionStatus(SubscriptionStatus.SUSPENDED);
                tenantRepository.save(tenant);
                audit(tenant, TenantSubscriptionAuditAction.AUTO_EXPIRED, previous, PlatformBillingStatus.EXPIRED);
                tenantSubscriptionGuard.evict(tenant.getHotel().getId());
            }
            for (PlatformTenant tenant : tenantRepository.findTenantsExpiringSoon(todayStart, soon)) {
                tenant.setBillingStatus(PlatformBillingStatus.EXPIRING_SOON);
                tenantRepository.save(tenant);
                tenantSubscriptionGuard.evict(tenant.getHotel().getId());
            }
        } finally {
            unlock();
        }
    }

    private boolean tryLock() {
        Boolean locked = jdbcTemplate.queryForObject("select pg_try_advisory_lock(?)", Boolean.class, LOCK_KEY);
        return Boolean.TRUE.equals(locked);
    }

    private void unlock() {
        jdbcTemplate.queryForObject("select pg_advisory_unlock(?)", Boolean.class, LOCK_KEY);
    }

    private void audit(
            PlatformTenant tenant,
            TenantSubscriptionAuditAction action,
            PlatformBillingStatus previous,
            PlatformBillingStatus next) {
        TenantSubscriptionAudit row = new TenantSubscriptionAudit();
        row.setHotelId(tenant.getHotel().getId());
        row.setAction(action);
        row.setPreviousStatus(previous);
        row.setNewStatus(next);
        row.setOldExpiry(tenant.getSubscriptionEnd());
        row.setNewExpiry(tenant.getSubscriptionEnd());
        row.setNote("Automatic subscription expiry enforcement");
        row.setCreatedAt(Instant.now(clock));
        auditRepository.save(row);
    }
}
