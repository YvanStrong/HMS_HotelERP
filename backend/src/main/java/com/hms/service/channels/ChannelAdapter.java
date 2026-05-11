package com.hms.service.channels;

import com.hms.entity.ChannelConnection;
import com.hms.entity.ChannelRatePlan;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Interface for OTA-specific channel adapters.
 */
public interface ChannelAdapter {
    
    /**
     * Pushes availability, rates, and restrictions to the OTA.
     * 
     * @param connection The channel connection containing credentials.
     * @param mappings The mapped rate plans to push.
     * @param data The gathered sync data (date -> data).
     * @return Result of the push operation.
     */
    SyncResult pushUpdate(ChannelConnection connection, List<ChannelRatePlan> mappings, Map<LocalDate, DailySyncData> data);

    record DailySyncData(int availability, java.math.BigDecimal baseRate) {}
    
    record SyncResult(boolean success, String message, String rawResponse) {}
}
