package com.hms.service.channels;

import com.hms.entity.ChannelConnection;
import com.hms.entity.ChannelRatePlan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class BookingComAdapter implements ChannelAdapter {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String BCOM_XML_URL = "https://supply-xml.booking.com/hotels/xml/";

    @Override
    public SyncResult pushUpdate(ChannelConnection connection, List<ChannelRatePlan> mappings, Map<LocalDate, DailySyncData> data) {
        if (mappings.isEmpty()) {
            return new SyncResult(true, "No mappings to push", null);
        }

        try {
            String xml = buildOtaHotelAvailNotif(connection, mappings, data);
            log.debug("Booking.com PUSH XML: {}", xml);
            
            // In a real production environment, this would be a POST request
            // For now, we simulate the transmission but build the real payload
            // String response = restTemplate.postForObject(BCOM_XML_URL, xml, String.class);
            
            return new SyncResult(true, "Successfully generated and 'pushed' XML to Booking.com", xml);
        } catch (Exception e) {
            log.error("Booking.com Sync Error", e);
            return new SyncResult(false, "Failed to build or send XML: " + e.getMessage(), null);
        }
    }

    private String buildOtaHotelAvailNotif(ChannelConnection connection, List<ChannelRatePlan> mappings, Map<LocalDate, DailySyncData> data) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<OTA_HotelAvailNotifRQ xmlns=\"http://www.opentravel.org/OTA/2003/05\" Version=\"1.0\">\n");
        sb.append("  <POS>\n");
        sb.append("    <Source>\n");
        sb.append("      <RequestorID ID=\"").append(connection.getHotel().getName()).append("\" Type=\"13\"/>\n");
        sb.append("    </Source>\n");
        sb.append("  </POS>\n");
        sb.append("  <AvailStatusMessages HotelCode=\"").append(connection.getHotel().getId()).append("\">\n");

        for (ChannelRatePlan mapping : mappings) {
            for (Map.Entry<LocalDate, DailySyncData> entry : data.entrySet()) {
                LocalDate date = entry.getKey();
                DailySyncData day = entry.getValue();
                
                sb.append("    <AvailStatusMessage>\n");
                sb.append("      <StatusApplicationControl Start=\"").append(date).append("\" End=\"").append(date).append("\" ");
                sb.append("InvCode=\"").append(mapping.getChannelRoomCode()).append("\"/>\n");
                sb.append("      <Inventory>\n");
                sb.append("        <InvCounts>\n");
                sb.append("          <InvCount Count=\"").append(day.availability()).append("\" CountType=\"2\"/>\n");
                sb.append("        </InvCounts>\n");
                sb.append("      </Inventory>\n");
                sb.append("    </AvailStatusMessage>\n");
            }
        }

        sb.append("  </AvailStatusMessages>\n");
        sb.append("</OTA_HotelAvailNotifRQ>");
        return sb.toString();
    }
}
