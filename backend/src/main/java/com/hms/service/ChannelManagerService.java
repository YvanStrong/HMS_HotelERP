package com.hms.service;

import com.hms.entity.*;
import com.hms.repository.*;
import com.hms.web.ApiException;
import java.time.Instant;
import java.time.LocalDate;
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
    private final RoomService roomService;
    private final com.hms.service.channels.BookingComAdapter bookingComAdapter;
    private final com.hms.service.channels.ExpediaAdapter expediaAdapter;
    private final RoomTypeRepository roomTypeRepo;

    public ChannelManagerService(ChannelConnectionRepository connRepo,
                                  ChannelRatePlanRepository ratePlanRepo,
                                  ChannelSyncLogRepository syncLogRepo,
                                  HotelRepository hotelRepo,
                                  RoomService roomService,
                                  com.hms.service.channels.BookingComAdapter bookingComAdapter,
                                  com.hms.service.channels.ExpediaAdapter expediaAdapter,
                                  RoomTypeRepository roomTypeRepo) {
        this.connRepo = connRepo;
        this.ratePlanRepo = ratePlanRepo;
        this.syncLogRepo = syncLogRepo;
        this.hotelRepo = hotelRepo;
        this.roomService = roomService;
        this.bookingComAdapter = bookingComAdapter;
        this.expediaAdapter = expediaAdapter;
        this.roomTypeRepo = roomTypeRepo;
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

    @Transactional
    public void deleteRatePlan(UUID planId) {
        ratePlanRepo.deleteById(planId);
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
            List<ChannelRatePlan> mappings = ratePlanRepo.findByConnection_Id(conn.getId());
            if (mappings.isEmpty()) {
                results.add(Map.of("channel", conn.getChannelCode(), "status", "SKIPPED", "detail", "No room mappings found"));
                continue;
            }

            // Gather 30 days of data for each unique room type in this connection
            Map<LocalDate, com.hms.service.channels.ChannelAdapter.DailySyncData> syncData = new HashMap<>();
            Set<UUID> roomTypeIds = new HashSet<>();
            mappings.forEach(m -> roomTypeIds.add(m.getRoomTypeId()));
            
            // For simplicity in Phase 1, we sync the first mapped room type's availability
            // Real multi-room sync will iterate over each mapping
            UUID rtId = roomTypeIds.iterator().next();
            syncData = gatherSyncData(hotelId, rtId);

            com.hms.service.channels.ChannelAdapter.SyncResult syncResult;
            if ("BOOKING_COM".equals(conn.getChannelCode())) {
                syncResult = bookingComAdapter.pushUpdate(conn, mappings, syncData);
            } else if ("EXPEDIA".equals(conn.getChannelCode())) {
                syncResult = expediaAdapter.pushUpdate(conn, mappings, syncData);
            } else {
                syncResult = new com.hms.service.channels.ChannelAdapter.SyncResult(true, "Mock Sync (No Adapter)", null);
            }

            ChannelSyncLog entry = new ChannelSyncLog();
            entry.setConnection(conn);
            entry.setDirection("PUSH");
            entry.setPayloadType("AVAILABILITY_AND_RATES");
            entry.setStatus(syncResult.success() ? "SUCCESS" : "ERROR");
            entry.setDetails(syncResult.message());
            syncLogRepo.save(entry);

            if (syncResult.success()) {
                conn.setLastSyncAt(Instant.now());
                connRepo.save(conn);
            }

            results.add(Map.of("channel", conn.getChannelCode(), "status", syncResult.success() ? "SYNCED" : "FAILED", "detail", syncResult.message()));
        }

        log.info("Channel sync triggered for hotel {}: {} channels", hotelId, connected.size());
        return Map.of("channelsSynced", connected.size(), "results", results);
    }

    private Map<LocalDate, com.hms.service.channels.ChannelAdapter.DailySyncData> gatherSyncData(UUID hotelId, UUID roomTypeId) {
        Map<LocalDate, com.hms.service.channels.ChannelAdapter.DailySyncData> results = new HashMap<>();
        LocalDate start = LocalDate.now();
        RoomType rt = roomTypeRepo.findById(roomTypeId).orElse(null);
        if (rt == null) return results;

        for (int i = 0; i < 30; i++) {
            LocalDate date = start.plusDays(i);
            int avail = roomService.countAvailableOnDate(hotelId, roomTypeId, date);
            results.put(date, new com.hms.service.channels.ChannelAdapter.DailySyncData(avail, rt.getBaseRate()));
        }
        return results;
    }

    // --- Sync Log ---

    @Transactional(readOnly = true)
    public Page<ChannelSyncLog> getSyncLog(UUID connectionId, int page, int size) {
        return syncLogRepo.findByConnection_IdOrderByCreatedAtDesc(connectionId, PageRequest.of(page, size));
    }
}
