package com.hms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.entity.StaffPushToken;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.StaffPushTokenRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final StaffPushTokenRepository staffPushTokenRepository;
    private final AppUserRepository appUserRepository;
    private final HotelRepository hotelRepository;
    private final InventoryDepotRepository inventoryDepotRepository;
    private final TenantAccessService tenantAccessService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public PushNotificationService(
            StaffPushTokenRepository staffPushTokenRepository,
            AppUserRepository appUserRepository,
            HotelRepository hotelRepository,
            InventoryDepotRepository inventoryDepotRepository,
            TenantAccessService tenantAccessService,
            @Qualifier("outboundRestTemplate") RestTemplate restTemplate,
            ObjectMapper objectMapper) {
        this.staffPushTokenRepository = staffPushTokenRepository;
        this.appUserRepository = appUserRepository;
        this.hotelRepository = hotelRepository;
        this.inventoryDepotRepository = inventoryDepotRepository;
        this.tenantAccessService = tenantAccessService;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void registerToken(UUID hotelId, String hotelHeader, String token, String deviceId, String platform) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        if (userId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        if (token == null || token.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "token required");
        }
        String plat = normalizePlatform(platform);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        AppUser user = appUserRepository.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        String devId = deviceId != null && !deviceId.isBlank() ? deviceId.trim() : "default";

        StaffPushToken row = staffPushTokenRepository
                .findByHotel_IdAndUser_IdAndDeviceId(hotelId, userId, devId)
                .orElseGet(StaffPushToken::new);
        row.setHotel(hotel);
        row.setUser(user);
        row.setDeviceId(devId);
        row.setPushToken(token.trim());
        row.setPlatform(plat);
        row.setActive(true);
        staffPushTokenRepository.save(row);
    }

    @Transactional
    public void deactivateToken(UUID hotelId, String hotelHeader, String deviceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        if (userId == null) {
            return;
        }
        String devId = deviceId != null && !deviceId.isBlank() ? deviceId.trim() : "default";
        staffPushTokenRepository.findByHotel_IdAndUser_IdAndDeviceId(hotelId, userId, devId).ifPresent(t -> {
            t.setActive(false);
            staffPushTokenRepository.save(t);
        });
    }

    public void sendToUser(UUID userId, String title, String body, Map<String, String> data) {
        List<StaffPushToken> tokens = staffPushTokenRepository.findByUser_IdAndActiveTrue(userId);
        if (tokens.isEmpty()) {
            return;
        }
        sendExpoPush(tokens, title, body, data);
    }

    public void sendToDepotStaff(UUID hotelId, UUID depotId, String title, String body, Map<String, String> data) {
        List<AppUser> staff = appUserRepository.findByHotel_IdAndRoleIn(
                hotelId,
                List.of(Role.HOTEL_ADMIN, Role.MANAGER, Role.FNB_STAFF, Role.WAITER, Role.CASHIER));
        for (AppUser user : staff) {
            if (!user.isActive()) {
                continue;
            }
            if (user.getRole() == Role.HOTEL_ADMIN || user.getRole() == Role.MANAGER) {
                sendToUser(user.getId(), title, body, data);
                continue;
            }
            if (user.getActiveDepot() != null && depotId.equals(user.getActiveDepot().getId())) {
                sendToUser(user.getId(), title, body, data);
            }
        }
    }

    @Transactional
    public void setActiveDepot(UUID hotelId, String hotelHeader, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        if (userId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        AppUser user = appUserRepository.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        if (depotId == null) {
            user.setActiveDepot(null);
        } else {
            user.setActiveDepot(inventoryDepotRepository
                    .findByIdAndHotel_Id(depotId, hotelId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Depot not found")));
        }
        appUserRepository.save(user);
    }

    private void sendExpoPush(List<StaffPushToken> tokens, String title, String body, Map<String, String> data) {
        List<Map<String, Object>> messages = new ArrayList<>();
        for (StaffPushToken t : tokens) {
            Map<String, Object> msg = new HashMap<>();
            msg.put("to", t.getPushToken());
            msg.put("title", title);
            msg.put("body", body);
            msg.put("sound", "default");
            msg.put("priority", "high");
            if (data != null && !data.isEmpty()) {
                msg.put("data", data);
            }
            messages.add(msg);
        }
        if (messages.isEmpty()) {
            return;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            ResponseEntity<String> res = restTemplate.postForEntity(
                    EXPO_PUSH_URL, new HttpEntity<>(messages, headers), String.class);
            handleExpoResponse(res.getBody(), tokens);
        } catch (Exception e) {
            log.warn("Expo push send failed: {}", e.getMessage());
        }
    }

    private void handleExpoResponse(String body, List<StaffPushToken> tokens) {
        if (body == null || body.isBlank()) {
            return;
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode data = root.get("data");
            if (data == null || !data.isArray()) {
                return;
            }
            for (int i = 0; i < data.size() && i < tokens.size(); i++) {
                JsonNode receipt = data.get(i);
                String status = receipt.path("status").asText("");
                if ("error".equals(status)) {
                    String detail = receipt.path("details").path("error").asText("");
                    if ("DeviceNotRegistered".equals(detail) || "InvalidCredentials".equals(detail)) {
                        StaffPushToken t = tokens.get(i);
                        t.setActive(false);
                        staffPushTokenRepository.save(t);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not parse Expo push response: {}", e.getMessage());
        }
    }

    private static String normalizePlatform(String platform) {
        if (platform == null) {
            return "android";
        }
        String p = platform.trim().toLowerCase();
        return "ios".equals(p) ? "ios" : "android";
    }
}
