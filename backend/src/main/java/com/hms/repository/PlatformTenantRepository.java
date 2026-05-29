package com.hms.repository;

import com.hms.domain.PlatformBillingStatus;
import com.hms.domain.SubscriptionTier;
import com.hms.entity.PlatformTenant;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlatformTenantRepository extends JpaRepository<PlatformTenant, UUID> {

    boolean existsBySubdomainIgnoreCase(String subdomain);

    /**
     * Text search is applied in {@link com.hms.service.PlatformTenantService} after load so mis-typed BYTEA
     * columns in legacy DBs do not break {@code lower()} in SQL.
     */
    @Query(
            """
            select t from PlatformTenant t join fetch t.hotel h
            where (:status is null or t.billingStatus = :status)
            and (:tier is null or t.tier = :tier)
            order by t.hotelName
            """)
    List<PlatformTenant> searchByStatusAndTier(
            @Param("status") PlatformBillingStatus status, @Param("tier") SubscriptionTier tier);

    @Query("select coalesce(sum(t.monthlyPrice), 0) from PlatformTenant t where t.billingStatus = 'ACTIVE'")
    java.math.BigDecimal sumActiveMonthlyPrice();

    @Query(
            """
            select t from PlatformTenant t join fetch t.hotel h
            where t.subscriptionEnd is not null
            and t.subscriptionEnd < :instant
            and t.billingStatus <> com.hms.domain.PlatformBillingStatus.EXPIRED
            and t.billingStatus <> com.hms.domain.PlatformBillingStatus.MANUALLY_BLOCKED
            """)
    List<PlatformTenant> findTenantsToExpire(@Param("instant") Instant instant);

    @Query(
            """
            select t from PlatformTenant t join fetch t.hotel h
            where t.subscriptionEnd is not null
            and t.subscriptionEnd >= :now
            and t.subscriptionEnd <= :soon
            and t.billingStatus = com.hms.domain.PlatformBillingStatus.ACTIVE
            """)
    List<PlatformTenant> findTenantsExpiringSoon(@Param("now") Instant now, @Param("soon") Instant soon);
}
