package com.hms.service.channels;

import com.hms.entity.ChannelConnection;
import com.hms.entity.ChannelRatePlan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDate;
import java.util.*;

@Service
@Slf4j
public class ExpediaAdapter implements ChannelAdapter {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String EXPEDIA_QC_URL = "https://services.expediapartnercentral.com/eqc/ar";

    @Override
    public SyncResult pushUpdate(ChannelConnection connection, List<ChannelRatePlan> mappings, Map<LocalDate, DailySyncData> data) {
        if (mappings.isEmpty()) {
            return new SyncResult(true, "No mappings to push", null);
        }

        try {
            // Expedia QuickConnect often uses XML for AR (Availability & Rates) 
            // but modern versions support JSON. We'll stick to a standard structure.
            Map<String, Object> payload = buildExpediaPayload(connection, mappings, data);
            log.debug("Expedia PUSH JSON: {}", payload);
            
            // Simulation of POST
            return new SyncResult(true, "Successfully generated and 'pushed' JSON to Expedia QuickConnect", payload.toString());
        } catch (Exception e) {
            log.error("Expedia Sync Error", e);
            return new SyncResult(false, "Failed to build or send Expedia update: " + e.getMessage(), null);
        }
    }

    private Map<String, Object> buildExpediaPayload(ChannelConnection connection, List<ChannelRatePlan> mappings, Map<LocalDate, DailySyncData> data) {
        Map<String, Object> root = new HashMap<>();
        List<Map<String, Object>> updates = new ArrayList<>();

        for (ChannelRatePlan mapping : mappings) {
            for (Map.Entry<LocalDate, DailySyncData> entry : data.entrySet()) {
                Map<String, Object> update = new HashMap<>();
                update.put("date", entry.getKey().toString());
                update.put("roomTypeCode", mapping.getChannelRoomCode());
                update.put("inventory", entry.getValue().availability());
                // Expedia specific markup logic
                update.put("rate", entry.getValue().baseRate().multiply(
                    java.math.BigDecimal.ONE.add(mapping.getRateMarkupPct().divide(new java.math.BigDecimal("100")))
                ).setScale(2, java.math.RoundingMode.HALF_UP));
                updates.add(update);
            }
        }

        root.put("hotelId", connection.getHotel().getId());
        root.put("inventoryUpdates", updates);
        return root;
    }
}
