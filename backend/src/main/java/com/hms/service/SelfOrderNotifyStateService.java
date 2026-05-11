package com.hms.service;

import com.hms.entity.SelfServiceOrder;
import com.hms.repository.SelfServiceOrderRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SelfOrderNotifyStateService {

    private final SelfServiceOrderRepository selfServiceOrderRepository;

    public SelfOrderNotifyStateService(SelfServiceOrderRepository selfServiceOrderRepository) {
        this.selfServiceOrderRepository = selfServiceOrderRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateNotifyOutcome(UUID orderId, String status, String detail) {
        SelfServiceOrder o = selfServiceOrderRepository.findById(orderId).orElse(null);
        if (o == null) {
            return;
        }
        o.setLastNotifyAt(Instant.now());
        o.setLastNotifyStatus(status);
        String d = detail == null ? null : detail.trim();
        if (d != null && d.length() > 512) {
            d = d.substring(0, 511) + "…";
        }
        o.setLastNotifyDetail(d);
        selfServiceOrderRepository.save(o);
    }
}
