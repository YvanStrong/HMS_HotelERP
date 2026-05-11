package com.hms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.config.SelfOrderNotifyProperties;
import com.hms.entity.Hotel;
import com.hms.entity.SelfOrderPushSubscription;
import com.hms.entity.SelfServiceOrder;
import com.hms.repository.HotelRepository;
import com.hms.repository.SelfOrderPushSubscriptionRepository;
import com.hms.repository.SelfServiceOrderRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.security.Security;
import java.util.UUID;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class SelfOrderNotificationService {

    private static final Logger log = LoggerFactory.getLogger(SelfOrderNotificationService.class);

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private final SelfOrderNotifyProperties notifyProperties;
    private final SelfOrderPushSubscriptionRepository pushSubscriptionRepository;
    private final HotelRepository hotelRepository;
    private final SelfServiceOrderRepository selfServiceOrderRepository;
    private final SelfOrderNotifyStateService notifyStateService;
    private final SelfOrderEventRecorder eventRecorder;
    private final RestTemplate outboundRestTemplate;
    private final ObjectMapper objectMapper;

    public SelfOrderNotificationService(
            SelfOrderNotifyProperties notifyProperties,
            SelfOrderPushSubscriptionRepository pushSubscriptionRepository,
            HotelRepository hotelRepository,
            SelfServiceOrderRepository selfServiceOrderRepository,
            SelfOrderNotifyStateService notifyStateService,
            SelfOrderEventRecorder eventRecorder,
            @Qualifier("outboundRestTemplate") RestTemplate outboundRestTemplate,
            ObjectMapper objectMapper) {
        this.notifyProperties = notifyProperties;
        this.pushSubscriptionRepository = pushSubscriptionRepository;
        this.hotelRepository = hotelRepository;
        this.selfServiceOrderRepository = selfServiceOrderRepository;
        this.notifyStateService = notifyStateService;
        this.eventRecorder = eventRecorder;
        this.outboundRestTemplate = outboundRestTemplate;
        this.objectMapper = objectMapper;
    }

    @Async
    public void dispatchOrderReady(SelfServiceOrder order) {
        UUID orderId = order.getId();
        UUID hotelId = order.getHotel().getId();
        try {
            SelfServiceOrder fresh =
                    selfServiceOrderRepository.findById(orderId).orElse(order);
            Hotel hotel = hotelRepository.findById(hotelId).orElse(fresh.getHotel());
            eventRecorder.record(hotelId, orderId, SelfOrderEventRecorder.NOTIFY_DISPATCHED, Map.of("code", fresh.getDisplayCode()));

            boolean smsOk = true;
            boolean pushOk = true;
            StringBuilder detail = new StringBuilder();

            if (hotel.isSelfOrderSmsEnabled()) {
                try {
                    sendTwilioIfConfigured(fresh, hotel);
                    eventRecorder.record(hotelId, orderId, SelfOrderEventRecorder.NOTIFY_SMS_OK, Map.of());
                } catch (Exception ex) {
                    smsOk = false;
                    eventRecorder.record(
                            hotelId, orderId, SelfOrderEventRecorder.NOTIFY_SMS_FAIL, Map.of("error", ex.toString()));
                    detail.append("SMS failed. ");
                    log.warn("Self-order Twilio failed for {}: {}", fresh.getDisplayCode(), ex.toString());
                }
            }

            if (hotel.isSelfOrderPushEnabled()) {
                try {
                    sendWebPushIfConfigured(fresh);
                    eventRecorder.record(hotelId, orderId, SelfOrderEventRecorder.NOTIFY_PUSH_OK, Map.of());
                } catch (Exception ex) {
                    pushOk = false;
                    eventRecorder.record(
                            hotelId, orderId, SelfOrderEventRecorder.NOTIFY_PUSH_FAIL, Map.of("error", ex.toString()));
                    detail.append("Push failed. ");
                    log.warn("Self-order Web Push batch failed for {}: {}", fresh.getDisplayCode(), ex.toString());
                }
            }

            String status = smsOk && pushOk ? "OK" : (!smsOk && !pushOk ? "FAILED" : "PARTIAL");
            if (!hotel.isSelfOrderSmsEnabled() && !hotel.isSelfOrderPushEnabled()) {
                notifyStateService.updateNotifyOutcome(orderId, "SKIPPED", "Hotel has SMS and push disabled.");
            } else {
                notifyStateService.updateNotifyOutcome(
                        orderId, status, detail.length() > 0 ? detail.toString().trim() : "Channels attempted.");
            }
        } catch (Exception e) {
            log.warn("Self-order READY notify failed for order {}: {}", orderId, e.toString());
            notifyStateService.updateNotifyOutcome(orderId, "ERROR", e.toString());
        }
    }

    private void sendTwilioIfConfigured(SelfServiceOrder order, Hotel hotel) {
        if (!notifyProperties.hasTwilio()) {
            return;
        }
        String to = order.getSmsNotifyPhone();
        if (to == null || to.isBlank()) {
            return;
        }
        String hotelLabel = hotel.getName() != null && !hotel.getName().isBlank() ? hotel.getName() : "Hotel";
        String body = "Your order " + order.getDisplayCode() + " at " + hotelLabel + " is ready for pickup.";
        String sid = notifyProperties.getTwilioAccountSid().trim();
        String url =
                "https://api.twilio.com/2010-04-01/Accounts/" + URLEncoder.encode(sid, StandardCharsets.UTF_8) + "/Messages.json";
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(sid, notifyProperties.getTwilioAuthToken().trim());
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("To", to.trim());
        form.add("From", notifyProperties.getTwilioFromNumber().trim());
        form.add("Body", body);
        RestClientException last = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                ResponseEntity<String> resp =
                        outboundRestTemplate.postForEntity(url, new HttpEntity<>(form, headers), String.class);
                if (resp.getStatusCode().is2xxSuccessful()) {
                    return;
                }
                last = new RestClientException("HTTP " + resp.getStatusCode());
            } catch (RestClientException ex) {
                last = ex;
            }
            try {
                Thread.sleep(250L * (attempt + 1));
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new RestClientException("interrupted", last);
            }
        }
        throw new RuntimeException("Twilio send failed after retries", last);
    }

    private void sendWebPushIfConfigured(SelfServiceOrder order) throws Exception {
        if (!notifyProperties.hasVapidKeys()) {
            return;
        }
        var subs = pushSubscriptionRepository.findByTrackToken(order.getTrackToken());
        if (subs.isEmpty()) {
            return;
        }
        PushService pushService = new PushService(
                notifyProperties.getVapidPublicKey().trim(),
                notifyProperties.getVapidPrivateKey().trim(),
                notifyProperties.getVapidSubject().trim());
        Map<String, String> payload = new HashMap<>();
        String who = order.getPickupDisplayName() != null && !order.getPickupDisplayName().isBlank()
                ? order.getPickupDisplayName().trim()
                : "Guest";
        payload.put("title", "Order " + order.getDisplayCode() + " is ready");
        payload.put("body", who + " — pick up when your code is called.");
        String json = objectMapper.writeValueAsString(payload);
        for (SelfOrderPushSubscription sub : subs) {
            try {
                Notification n = new Notification(sub.getEndpoint(), sub.getP256dh(), sub.getAuthSecret(), json);
                pushService.send(n);
            } catch (Exception ex) {
                if (isSubscriptionGone(ex)) {
                    pushSubscriptionRepository.delete(sub);
                    eventRecorder.record(
                            order.getHotel().getId(),
                            order.getId(),
                            SelfOrderEventRecorder.NOTIFY_PUSH_SUB_GONE,
                            Map.of("subscriptionId", sub.getId().toString()));
                } else {
                    log.debug("Web push failed for subscription {}: {}", sub.getId(), ex.toString());
                }
            }
        }
    }

    private static boolean isSubscriptionGone(Throwable ex) {
        String m = ex.toString().toLowerCase();
        return m.contains("410") || m.contains("gone") || m.contains("not registered");
    }
}
