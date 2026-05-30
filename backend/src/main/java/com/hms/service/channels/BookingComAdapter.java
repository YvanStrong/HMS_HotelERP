package com.hms.service.channels;

import com.hms.entity.ChannelConnection;
import com.hms.entity.ChannelRatePlan;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@Slf4j
public class BookingComAdapter implements ChannelAdapter {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper;
    private static final String DEFAULT_AVAILABILITY_ENDPOINT = "https://supply-xml.booking.com/ota/OTA_HotelAvailNotif";

    public BookingComAdapter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public SyncResult pushUpdate(ChannelConnection connection, List<ChannelRatePlan> mappings, Map<LocalDate, DailySyncData> data) {
        if (mappings.isEmpty()) {
            return new SyncResult(true, "No mappings to push", null);
        }

        try {
            Map<String, String> credentials = parseJson(connection.getCredentials());
            Map<String, String> config = parseJson(connection.getConfig());
            String username = credentials.get("username");
            String password = credentials.get("password");
            String hotelCode = config.get("hotelCode");
            String endpoint = config.getOrDefault("availabilityEndpoint", DEFAULT_AVAILABILITY_ENDPOINT);

            if (isBlank(username) || isBlank(password)) {
                return new SyncResult(false, "Booking.com username/password are not configured.", null);
            }
            if (isBlank(hotelCode)) {
                return new SyncResult(false, "Booking.com hotel/property code is not configured.", null);
            }

            String apiUsername = Objects.requireNonNull(username).trim();
            String apiPassword = Objects.requireNonNull(password);
            String apiHotelCode = Objects.requireNonNull(hotelCode).trim();
            String apiEndpoint = isBlank(endpoint) ? DEFAULT_AVAILABILITY_ENDPOINT : Objects.requireNonNull(endpoint).trim();

            String xml = buildOtaHotelAvailNotif(mappings, data, apiHotelCode, apiUsername);
            log.debug("Booking.com PUSH XML: {}", xml);

            HttpHeaders headers = new HttpHeaders();
            String token = Base64.getEncoder().encodeToString((apiUsername + ":" + apiPassword).getBytes(StandardCharsets.UTF_8));
            headers.set(HttpHeaders.AUTHORIZATION, "Basic " + token);
            headers.setContentType(MediaType.APPLICATION_XML);
            headers.add(HttpHeaders.ACCEPT, "application/xml, text/xml, text/plain");
            URI apiUri = Objects.requireNonNull(URI.create(apiEndpoint));

            ResponseEntity<String> response = restTemplate.postForEntity(apiUri, new HttpEntity<>(xml, headers), String.class);
            return new SyncResult(
                    response.getStatusCode().is2xxSuccessful(),
                    "Booking.com availability sync response: HTTP " + response.getStatusCode().value(),
                    response.getBody()
            );
        } catch (Exception e) {
            log.error("Booking.com Sync Error", e);
            return new SyncResult(false, "Failed to build or send XML: " + e.getMessage(), null);
        }
    }

    private String buildOtaHotelAvailNotif(List<ChannelRatePlan> mappings, Map<LocalDate, DailySyncData> data, String hotelCode, String requestorId) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<OTA_HotelAvailNotifRQ xmlns=\"http://www.opentravel.org/OTA/2003/05\" Version=\"1.0\">\n");
        sb.append("  <POS>\n");
        sb.append("    <Source>\n");
        sb.append("      <RequestorID ID=\"").append(escapeXml(requestorId)).append("\" Type=\"13\"/>\n");
        sb.append("    </Source>\n");
        sb.append("  </POS>\n");
        sb.append("  <AvailStatusMessages HotelCode=\"").append(escapeXml(hotelCode)).append("\">\n");

        for (ChannelRatePlan mapping : mappings) {
            for (Map.Entry<LocalDate, DailySyncData> entry : data.entrySet()) {
                LocalDate date = entry.getKey();
                DailySyncData day = entry.getValue();
                
                sb.append("    <AvailStatusMessage>\n");
                sb.append("      <StatusApplicationControl Start=\"").append(date).append("\" End=\"").append(date).append("\" ");
                sb.append("InvCode=\"").append(escapeXml(mapping.getChannelRoomCode())).append("\"/>\n");
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

    private Map<String, String> parseJson(String json) {
        if (isBlank(json)) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            log.warn("Invalid Booking.com channel JSON config", e);
            return new HashMap<>();
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String escapeXml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
