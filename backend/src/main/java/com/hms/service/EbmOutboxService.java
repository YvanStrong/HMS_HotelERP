package com.hms.service;

import com.hms.config.HmsEbmProperties;
import com.hms.ebm.EbmApiException;
import com.hms.ebm.EbmClient;
import com.hms.entity.EbmDevice;
import com.hms.entity.EbmOutboxEntry;
import com.hms.entity.TaxableSaleEvent;
import com.hms.repository.EbmDeviceRepository;
import com.hms.repository.EbmOutboxRepository;
import com.hms.repository.TaxableSaleEventRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EbmOutboxService {

    private static final Logger log = LoggerFactory.getLogger(EbmOutboxService.class);

    private final HmsEbmProperties properties;
    private final EbmDeviceRepository deviceRepository;
    private final EbmOutboxRepository outboxRepository;
    private final TaxableSaleEventRepository saleEventRepository;
    private final EbmClient ebmClient;

    public EbmOutboxService(
            HmsEbmProperties properties,
            EbmDeviceRepository deviceRepository,
            EbmOutboxRepository outboxRepository,
            TaxableSaleEventRepository saleEventRepository,
            EbmClient ebmClient) {
        this.properties = properties;
        this.deviceRepository = deviceRepository;
        this.outboxRepository = outboxRepository;
        this.saleEventRepository = saleEventRepository;
        this.ebmClient = ebmClient;
    }

    @Transactional
    public void processDevice(UUID deviceId) {
        EbmDevice device = deviceRepository.findById(deviceId).orElse(null);
        if (device == null || !device.isActive()) {
            return;
        }
        List<EbmOutboxEntry> ready =
                outboxRepository.findReadyToSubmit(deviceId, PageRequest.of(0, properties.getOutboxBatchSize()));
        for (EbmOutboxEntry entry : ready) {
            submitOne(device, entry);
        }
    }

    private void submitOne(EbmDevice device, EbmOutboxEntry entry) {
        entry.setAttempts(entry.getAttempts() + 1);
        entry.setSubmittedAt(Instant.now());
        entry.setStatus("SENT");
        try {
            Map<String, Object> response = ebmClient.submitPhase(device, entry.getPhase(), entry.getPayload());
            entry.setResponse(response);
            if (isRejected(response)) {
                String msg = String.valueOf(response.getOrDefault("resultMsg", "rejected"));
                entry.setLastError(msg);
                if (is922(response)) {
                    entry.setStatus("BLOCKED");
                    entry.setLastError("API error 922 — invoice without prior transaction. Check sequencing.");
                    log.error("EBM 922 on outbox {} phase {}", entry.getId(), entry.getPhase());
                } else {
                    entry.setStatus("FAILED");
                }
                markSaleFailed(entry);
                outboxRepository.save(entry);
                return;
            }
            entry.setStatus("ACKED");
            entry.setAckedAt(Instant.now());
            entry.setLastError(null);
            outboxRepository.save(entry);
            onAcked(device, entry, response);
        } catch (EbmApiException ex) {
            entry.setStatus(ex.isError922() ? "BLOCKED" : "FAILED");
            entry.setLastError(ex.getMessage());
            entry.setResponse(ex.getResponse());
            markSaleFailed(entry);
            outboxRepository.save(entry);
        } catch (Exception ex) {
            entry.setStatus("FAILED");
            entry.setLastError(ex.getMessage());
            outboxRepository.save(entry);
        }
    }

    private void onAcked(EbmDevice device, EbmOutboxEntry entry, Map<String, Object> response) {
        TaxableSaleEvent sale = entry.getSaleEvent();
        if (sale == null) {
            return;
        }
        if ("INVOICE".equals(entry.getPhase())) {
            Object receipt = first(response, "rcptNo", "receiptNo", "invcNo");
            Object signature = first(response, "rcptSign", "signature", "intrlData");
            Object qr = first(response, "qrCode", "qrPayload", "sdcQr");
            if (receipt != null) {
                sale.setEbmReceiptNo(String.valueOf(receipt));
            }
            if (signature != null) {
                sale.setEbmSignature(String.valueOf(signature));
            }
            if (qr != null) {
                sale.setEbmQrPayload(String.valueOf(qr));
            }
            sale.setEbmStatus("SUBMITTED");
            device.setLastSignatureAt(Instant.now());
            deviceRepository.save(device);
            saleEventRepository.save(sale);
        }
        if ("STOCK_MASTER".equals(entry.getPhase())) {
            sale.setEbmStatus("CONFIRMED");
            saleEventRepository.save(sale);
        } else if ("INVOICE".equals(entry.getPhase())) {
            boolean hasLater = outboxRepository
                    .findByDevice_Hotel_IdOrderByCreatedAtDesc(device.getHotel().getId(), PageRequest.of(0, 100))
                    .stream()
                    .anyMatch(e -> e.getSaleEvent() != null
                            && e.getSaleEvent().getId().equals(sale.getId())
                            && List.of("STOCK_IO", "STOCK_MASTER").contains(e.getPhase())
                            && !"ACKED".equals(e.getStatus()));
            if (!hasLater) {
                sale.setEbmStatus("CONFIRMED");
                saleEventRepository.save(sale);
            }
        }
    }

    private void markSaleFailed(EbmOutboxEntry entry) {
        if (entry.getSaleEvent() != null) {
            entry.getSaleEvent().setEbmStatus("FAILED");
            saleEventRepository.save(entry.getSaleEvent());
        }
    }

    private static boolean isRejected(Map<String, Object> response) {
        Object cd = response.get("resultCd");
        if (cd == null) {
            cd = response.get("resultCode");
        }
        if (cd == null) {
            return false;
        }
        String s = String.valueOf(cd);
        return !(s.equals("000") || s.equals("00") || s.equals("0"));
    }

    private static boolean is922(Map<String, Object> response) {
        Object cd = response.get("resultCd");
        if (cd == null) {
            cd = response.get("resultCode");
        }
        String s = String.valueOf(cd);
        return "922".equals(s) || s.contains("922");
    }

    private static Object first(Map<String, Object> map, String... keys) {
        Object data = map.get("data");
        if (data instanceof Map<?, ?> nested) {
            for (String k : keys) {
                if (nested.get(k) != null) {
                    return nested.get(k);
                }
            }
        }
        for (String k : keys) {
            if (map.get(k) != null) {
                return map.get(k);
            }
        }
        return null;
    }
}
