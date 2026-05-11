package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.entity.SelfOrderEvent;
import com.hms.entity.SelfServiceOrder;
import com.hms.repository.HotelRepository;
import com.hms.repository.SelfOrderEventRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SelfOrderEventRecorder {

    public static final String ORDER_PLACED = "ORDER_PLACED";
    public static final String ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED";
    public static final String NOTIFY_DISPATCHED = "NOTIFY_DISPATCHED";
    public static final String NOTIFY_SMS_OK = "NOTIFY_SMS_OK";
    public static final String NOTIFY_SMS_FAIL = "NOTIFY_SMS_FAIL";
    public static final String NOTIFY_PUSH_OK = "NOTIFY_PUSH_OK";
    public static final String NOTIFY_PUSH_FAIL = "NOTIFY_PUSH_FAIL";
    public static final String NOTIFY_PUSH_SUB_GONE = "NOTIFY_PUSH_SUB_GONE";

    private final SelfOrderEventRepository selfOrderEventRepository;
    private final HotelRepository hotelRepository;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<MeterRegistry> meterRegistry;

    public SelfOrderEventRecorder(
            SelfOrderEventRepository selfOrderEventRepository,
            HotelRepository hotelRepository,
            ObjectMapper objectMapper,
            ObjectProvider<MeterRegistry> meterRegistry) {
        this.selfOrderEventRepository = selfOrderEventRepository;
        this.hotelRepository = hotelRepository;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
    }

    @Transactional
    public void record(UUID hotelId, UUID orderId, String eventType, Map<String, Object> payload) {
        SelfOrderEvent e = new SelfOrderEvent();
        e.setId(UUID.randomUUID());
        e.setHotel(hotelRepository.getReferenceById(hotelId));
        if (orderId != null) {
            SelfServiceOrder ref = new SelfServiceOrder();
            ref.setId(orderId);
            e.setOrder(ref);
        } else {
            e.setOrder(null);
        }
        e.setEventType(eventType);
        try {
            e.setPayloadJson(payload == null || payload.isEmpty() ? null : objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException ex) {
            e.setPayloadJson("{\"error\":\"payload_serialization\"}");
        }
        String cid = MDC.get("correlationId");
        e.setCorrelationId(cid != null && !cid.isBlank() ? cid.substring(0, Math.min(80, cid.length())) : null);
        e.setCreatedAt(Instant.now());
        selfOrderEventRepository.save(e);
        MeterRegistry mr = meterRegistry.getIfAvailable();
        if (mr != null) {
            if (ORDER_PLACED.equals(eventType)) {
                mr.counter("hms.self_order.events", "type", ORDER_PLACED).increment();
            }
            if (eventType != null && eventType.endsWith("_FAIL")) {
                mr.counter("hms.self_order.notify", "result", "fail").increment();
            }
        }
    }
}
