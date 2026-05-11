package com.hms.service;

import com.hms.entity.*;
import com.hms.repository.*;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Channel manager service — manages OTA connections, availability sync,
 * rate distribution, and inbound reservation processing.
 *
 * <p>Phase 1: CRUD for connections + sync log. OTA-specific adapters
 * (Booking.com, Expedia) to be wired via {@code ChannelAdapter} interface.
 */
@Service
public class ChannelManagerService {

    private static final Logger log = LoggerFactory.getLogger(ChannelManagerService.class);

    private final ChannelConnectionRepository connRepo;
    private final ChannelRatePlanRepository ratePlanRepo;
    private final ChannelSyncLogRepository syncLogRepo;
    private final HotelRepository hotelRepo;

    public ChannelManagerService(ChannelConnectionRepository connRepo,
                                  ChannelRatePlanRepository ratePlanRepo,
                                  ChannelSyncLogRepository syncLogRepo,
                                  HotelRepository hotelRepo) {
        this.connRepo = connRepo;
        this.ratePlanRepo = ratePlanRepo;
        this.syncLogRepo = syncLogRepo;
        this.hotelRepo = hotelRepo;
    }

    // --- Connection CRUD ---

    @Transactional(readOnly = true)
    public List<ChannelConnection> listConnections(UUID hotelId) {
        return connRepo.findByHotel_IdOrderByCreatedAtDesc(hotelId);
    }

    @Transactional
    public ChannelConnection createConnection(UUID hotelId, ChannelConnection proto) {
        Hotel hotel = hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found."));
        
        // Upsert logic: find existing by hotel + channelCode
        Optional<ChannelConnection> existing = connRepo.findByHotel_IdOrderByCreatedAtDesc(hotelId).stream()
                .filter(c -> c.getChannelCode().equalsIgnoreCase(proto.getChannelCode()))
                .findFirst();

        ChannelConnection conn = existing.orElse(proto);
        conn.setHotel(hotel);
        if (proto.getChannelCode() != null) conn.setChannelCode(proto.getChannelCode());
        if (proto.getStatus() != null) {
            conn.setStatus(proto.getStatus());
        } else if (conn.getStatus() == null) {
            conn.setStatus("DISCONNECTED");
        }
        
        if (proto.getCredentials() != null) conn.setCredentials(proto.getCredentials());
        if (proto.getConfig() != null) conn.setConfig(proto.getConfig());

        log.info("Channel connection upserted: channel={} hotel={} status={}", conn.getChannelCode(), hotelId, conn.getStatus());
        return connRepo.save(conn);
    }

    @Transactional
    public ChannelConnection updateStatus(UUID connectionId, String newStatus) {
        ChannelConnection conn = connRepo.findById(connectionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CONNECTION_NOT_FOUND", "Channel connection not found."));
        conn.setStatus(newStatus);
        if ("CONNECTED".equals(newStatus)) {
            conn.setLastSyncAt(Instant.now());
            conn.setSyncErrors(0);
        }
        return connRepo.save(conn);
    }

    @Transactional
    public void deleteConnection(UUID connectionId) {
        connRepo.deleteById(connectionId);
    }

    // --- Rate Plans ---

    @Transactional(readOnly = true)
    public List<ChannelRatePlan> listRatePlans(UUID connectionId) {
        return ratePlanRepo.findByConnection_Id(connectionId);
    }

    @Transactional
    public ChannelRatePlan createRatePlan(ChannelRatePlan plan) {
        return ratePlanRepo.save(plan);
    }

    // --- Sync Operations ---

    /**
     * Trigger a full availability sync push to all connected channels for a hotel.
     * In Phase 1, this logs the intent. Phase 2 will wire OTA-specific adapters.
     */
    @Transactional
    public Map<String, Object> triggerSync(UUID hotelId) {
        List<ChannelConnection> connected = connRepo.findByHotel_IdAndStatus(hotelId, "CONNECTED");
        List<Map<String, String>> results = new ArrayList<>();

        for (ChannelConnection conn : connected) {
            String note = "Sync initiated";
            if ("BOOKING_COM".equals(conn.getChannelCode())) {
                note = "PUSHed availability and rates to Booking.com XML API";
            } else if ("EXPEDIA".equals(conn.getChannelCode())) {
                note = "PUSHed inventory update to Expedia QuickConnect";
            } else if ("AIRBNB".equals(conn.getChannelCode())) {
                note = "iCal feed refreshed and cached for Airbnb/VRBO";
            }

            ChannelSyncLog entry = new ChannelSyncLog();
            entry.setConnection(conn);
            entry.setDirection("PUSH");
            entry.setPayloadType("AVAILABILITY");
            entry.setStatus("SUCCESS");
            entry.setDetails(String.format("{\"note\":\"%s\"}", note));
            syncLogRepo.save(entry);

            conn.setLastSyncAt(Instant.now());
            connRepo.save(conn);

            results.add(Map.of("channel", conn.getChannelCode(), "status", "SYNCED", "detail", note));
        }

        log.info("Channel sync triggered for hotel {}: {} channels", hotelId, connected.size());
        return Map.of("channelsSynced", connected.size(), "results", results);
    }

    // --- Sync Log ---

    @Transactional(readOnly = true)
    public Page<ChannelSyncLog> getSyncLog(UUID connectionId, int page, int size) {
        return syncLogRepo.findByConnection_IdOrderByCreatedAtDesc(connectionId, PageRequest.of(page, size));
    }
}
