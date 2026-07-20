package com.hms.ebm;

import com.hms.config.HmsEbmProperties;
import com.hms.entity.EbmDevice;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * HTTP client for VSDC/OSDC. Paths are configurable ({@link HmsEbmProperties.Paths}).
 * Confirm exact field names against the official RRA EBM 2.1 guide when available.
 */
@Component
public class EbmClient {

    private static final Logger log = LoggerFactory.getLogger(EbmClient.class);

    private final HmsEbmProperties properties;
    private final EbmKeyCrypto keyCrypto;
    private final RestClient restClient;

    public EbmClient(HmsEbmProperties properties, EbmKeyCrypto keyCrypto) {
        this.properties = properties;
        this.keyCrypto = keyCrypto;
        this.restClient = RestClient.builder().build();
    }

    public Map<String, Object> initialize(EbmDevice device) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("tin", device.getTin());
        body.put("bhfId", device.getBranchId());
        body.put("dvcSrlNo", device.getDeviceSerialNo());
        return post(device, properties.getPaths().getInit(), body);
    }

    public Map<String, Object> submitPhase(EbmDevice device, String phase, Map<String, Object> payload) {
        String path = switch (phase) {
            case "TRANSACTION" -> properties.getPaths().getSalesTransaction();
            case "INVOICE" -> properties.getPaths().getSalesInvoice();
            case "STOCK_IO" -> properties.getPaths().getStockIo();
            case "STOCK_MASTER" -> properties.getPaths().getStockMaster();
            default -> throw new IllegalArgumentException("Unknown EBM phase: " + phase);
        };
        Map<String, Object> body = new LinkedHashMap<>(payload);
        body.putIfAbsent("tin", device.getTin());
        body.putIfAbsent("bhfId", device.getBranchId());
        body.putIfAbsent("sdcId", device.getSdcId());
        body.putIfAbsent("mrcNo", device.getMrcNo());
        return post(device, path, body);
    }

    public Map<String, Object> pullCodeList(EbmDevice device, String category, Instant lastReqDt) {
        String path = "ITEM_CLASS".equals(category)
                ? properties.getPaths().getItemClass()
                : properties.getPaths().getCodeList();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("tin", device.getTin());
        body.put("bhfId", device.getBranchId());
        body.put("lastReqDt", lastReqDt != null ? lastReqDt.toString() : "20160523000000");
        body.put("cdCls", category);
        return post(device, path, body);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> post(EbmDevice device, String path, Map<String, Object> body) {
        String base = requireBaseUrl(device);
        String url = joinUrl(base, path);
        try {
            Map<String, Object> response = restClient
                    .post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(h -> {
                        String key = keyCrypto.decrypt(device.getEncryptedSigningKey());
                        if (key != null && !key.isBlank()) {
                            h.set("Authorization", "Bearer " + key);
                            h.set("X-SDC-ID", device.getSdcId() != null ? device.getSdcId() : "");
                            h.set("X-MRC-NO", device.getMrcNo() != null ? device.getMrcNo() : "");
                        }
                    })
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            return response != null ? response : Map.of();
        } catch (RestClientResponseException ex) {
            log.warn("EBM HTTP {} {} → {}", ex.getStatusCode().value(), url, ex.getResponseBodyAsString());
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("httpStatus", ex.getStatusCode().value());
            err.put("body", ex.getResponseBodyAsString());
            err.put("resultCd", String.valueOf(ex.getStatusCode().value()));
            err.put("resultMsg", ex.getResponseBodyAsString());
            throw new EbmApiException(ex.getStatusCode().value(), ex.getResponseBodyAsString(), err);
        } catch (Exception ex) {
            throw new EbmApiException(0, ex.getMessage(), Map.of("resultMsg", String.valueOf(ex.getMessage())));
        }
    }

    private static String requireBaseUrl(EbmDevice device) {
        if (device.getVsdcEndpointUrl() == null || device.getVsdcEndpointUrl().isBlank()) {
            throw new EbmApiException(0, "Device vsdcEndpointUrl is not configured", Map.of());
        }
        return device.getVsdcEndpointUrl().trim().replaceAll("/+$", "");
    }

    private static String joinUrl(String base, String path) {
        if (path == null || path.isBlank()) {
            return base;
        }
        return path.startsWith("/") ? base + path : base + "/" + path;
    }
}
