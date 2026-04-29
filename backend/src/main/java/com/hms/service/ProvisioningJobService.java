package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.domain.ProvisioningJobStatus;
import com.hms.domain.ProvisioningJobType;
import com.hms.entity.ProvisioningJob;
import com.hms.repository.ProvisioningJobRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProvisioningJobService {

    private final ProvisioningJobRepository provisioningJobRepository;
    private final ObjectMapper objectMapper;

    public ProvisioningJobService(ProvisioningJobRepository provisioningJobRepository, ObjectMapper objectMapper) {
        this.provisioningJobRepository = provisioningJobRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void enqueue(UUID tenantId, ProvisioningJobType type, Map<String, Object> payload) {
        ProvisioningJob j = new ProvisioningJob();
        j.setTenantId(tenantId);
        j.setJobType(type);
        j.setStatus(ProvisioningJobStatus.PENDING);
        j.setAttempts(0);
        try {
            j.setPayloadJson(payload == null || payload.isEmpty() ? null : objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            j.setPayloadJson("{}");
        }
        provisioningJobRepository.save(j);
    }
}
