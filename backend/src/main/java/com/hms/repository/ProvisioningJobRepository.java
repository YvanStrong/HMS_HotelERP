package com.hms.repository;

import com.hms.domain.ProvisioningJobStatus;
import com.hms.entity.ProvisioningJob;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProvisioningJobRepository extends JpaRepository<ProvisioningJob, UUID> {

    Optional<ProvisioningJob> findTop1ByStatusOrderByCreatedAtAsc(ProvisioningJobStatus status);
}
