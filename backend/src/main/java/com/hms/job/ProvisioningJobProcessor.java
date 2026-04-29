package com.hms.job;

import com.hms.config.HmsMultitenancyProperties;
import com.hms.domain.ProvisioningJobStatus;
import com.hms.domain.ProvisioningJobType;
import com.hms.entity.ProvisioningJob;
import com.hms.multitenancy.SchemaProvisioningService;
import com.hms.repository.ProvisioningJobRepository;
import com.hms.service.StripeBillingService;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ProvisioningJobProcessor {

    private static final Logger log = LoggerFactory.getLogger(ProvisioningJobProcessor.class);

    private final ProvisioningJobRepository provisioningJobRepository;
    private final SchemaProvisioningService schemaProvisioningService;
    private final StripeBillingService stripeBillingService;
    private final HmsMultitenancyProperties multitenancyProperties;
    public ProvisioningJobProcessor(
            ProvisioningJobRepository provisioningJobRepository,
            SchemaProvisioningService schemaProvisioningService,
            StripeBillingService stripeBillingService,
            HmsMultitenancyProperties multitenancyProperties) {
        this.provisioningJobRepository = provisioningJobRepository;
        this.schemaProvisioningService = schemaProvisioningService;
        this.stripeBillingService = stripeBillingService;
        this.multitenancyProperties = multitenancyProperties;
    }

    @Scheduled(fixedDelayString = "${hms.provisioning.poll-ms:5000}")
    @Transactional
    public void processNext() {
        provisioningJobRepository
                .findTop1ByStatusOrderByCreatedAtAsc(ProvisioningJobStatus.PENDING)
                .ifPresent(this::handle);
    }

    private void handle(ProvisioningJob job) {
        job.setStatus(ProvisioningJobStatus.RUNNING);
        job.setAttempts(job.getAttempts() + 1);
        provisioningJobRepository.save(job);
        try {
            switch (job.getJobType()) {
                case CREATE_TENANT_SCHEMA -> {
                    if (multitenancyProperties.isSchemaIsolationEnabled()) {
                        schemaProvisioningService.ensureTenantSchema(job.getTenantId());
                    }
                }
                case STRIPE_CUSTOMER_SYNC -> stripeBillingService.syncCustomerForTenant(job.getTenantId(), job.getPayloadJson());
                case USAGE_SNAPSHOT -> log.debug("USAGE_SNAPSHOT job is handled by PlatformUsageMetricsJob");
                case NOTIFY_WELCOME -> log.info("Welcome notification placeholder for tenant {}", job.getTenantId());
            }
            job.setStatus(ProvisioningJobStatus.DONE);
            job.setLastError(null);
        } catch (Exception e) {
            log.warn("Provisioning job {} failed: {}", job.getId(), e.toString());
            job.setStatus(ProvisioningJobStatus.FAILED);
            job.setLastError(e.getMessage());
        }
        job.setUpdatedAt(Instant.now());
        provisioningJobRepository.save(job);
    }
}
