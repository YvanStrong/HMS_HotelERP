package com.hms.service;

import com.hms.api.dto.EbmDtos;
import com.hms.config.HmsEbmProperties;
import com.hms.ebm.EbmApiException;
import com.hms.ebm.EbmClient;
import com.hms.ebm.EbmKeyCrypto;
import com.hms.entity.EbmDevice;
import com.hms.entity.EbmSyncCursor;
import com.hms.entity.Hotel;
import com.hms.repository.EbmDeviceRepository;
import com.hms.repository.EbmOutboxRepository;
import com.hms.repository.EbmSyncCursorRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.TaxableSaleEventRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EbmDeviceService {

    private final EbmDeviceRepository deviceRepository;
    private final EbmSyncCursorRepository syncCursorRepository;
    private final EbmOutboxRepository outboxRepository;
    private final TaxableSaleEventRepository saleEventRepository;
    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;
    private final EbmClient ebmClient;
    private final EbmKeyCrypto keyCrypto;
    private final HmsEbmProperties properties;

    public EbmDeviceService(
            EbmDeviceRepository deviceRepository,
            EbmSyncCursorRepository syncCursorRepository,
            EbmOutboxRepository outboxRepository,
            TaxableSaleEventRepository saleEventRepository,
            HotelRepository hotelRepository,
            TenantAccessService tenantAccessService,
            EbmClient ebmClient,
            EbmKeyCrypto keyCrypto,
            HmsEbmProperties properties) {
        this.deviceRepository = deviceRepository;
        this.syncCursorRepository = syncCursorRepository;
        this.outboxRepository = outboxRepository;
        this.saleEventRepository = saleEventRepository;
        this.hotelRepository = hotelRepository;
        this.tenantAccessService = tenantAccessService;
        this.ebmClient = ebmClient;
        this.keyCrypto = keyCrypto;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public EbmDtos.StatusResponse status(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        List<EbmDtos.DeviceView> devices = deviceRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId).stream()
                .map(this::toView)
                .toList();
        long pending = outboxRepository.countByDevice_Hotel_IdAndStatusIn(hotelId, List.of("PENDING", "FAILED"));
        long failedSales = saleEventRepository.countByHotel_IdAndEbmStatus(hotelId, "FAILED");
        EbmDevice active = deviceRepository
                .findFirstByHotel_IdAndStatusOrderByCreatedAtDesc(hotelId, "ACTIVE")
                .orElse(null);
        String offlineLevel = offlineLevel(active);
        return new EbmDtos.StatusResponse(
                properties.isEnabled(),
                hotel.getTinNumber(),
                devices,
                pending,
                failedSales,
                offlineLevel,
                active != null ? active.getLastSignatureAt() : null);
    }

    @Transactional
    public EbmDtos.DeviceView registerOrUpdate(UUID hotelId, String hotelHeader, EbmDtos.RegisterDeviceRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        String mode = req.mode() == null ? "VSDC" : req.mode().trim().toUpperCase();
        if (!"VSDC".equals(mode) && !"OSDC".equals(mode)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "mode must be VSDC or OSDC");
        }
        if (req.deviceSerialNo() == null || req.deviceSerialNo().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "deviceSerialNo is required");
        }
        if (req.vsdcEndpointUrl() == null || req.vsdcEndpointUrl().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "vsdcEndpointUrl is required (WAR URL or OSDC base URL)");
        }
        String tin = req.tin() != null && !req.tin().isBlank()
                ? req.tin().trim()
                : (hotel.getTinNumber() != null ? hotel.getTinNumber().trim() : null);
        if (tin == null || tin.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TIN is required (set hotel TIN or pass tin)");
        }

        EbmDevice device = deviceRepository
                .findByHotel_IdOrderByCreatedAtDesc(hotelId)
                .stream()
                .filter(d -> d.getDeviceSerialNo().equalsIgnoreCase(req.deviceSerialNo().trim()))
                .findFirst()
                .orElseGet(EbmDevice::new);

        if (device.getId() != null && device.isActive()) {
            // Allow metadata updates but not re-init of ACTIVE device via this path
            device.setVsdcEndpointUrl(req.vsdcEndpointUrl().trim());
            device.setBranchId(trim(req.branchId()));
            device.setUpdatedAt(Instant.now());
            return toView(deviceRepository.save(device));
        }

        device.setHotel(hotel);
        device.setMode(mode);
        device.setTin(tin);
        device.setBranchId(trim(req.branchId()));
        device.setDeviceSerialNo(req.deviceSerialNo().trim());
        device.setVsdcEndpointUrl(req.vsdcEndpointUrl().trim());
        device.setStatus("PENDING_INIT");
        device.setLastError(null);
        if (hotel.getTinNumber() == null || hotel.getTinNumber().isBlank()) {
            hotel.setTinNumber(tin);
            hotelRepository.save(hotel);
        }
        return toView(deviceRepository.save(device));
    }

    @Transactional
    public EbmDtos.DeviceView initialize(UUID hotelId, String hotelHeader, UUID deviceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        EbmDevice device = deviceRepository
                .findByIdAndHotel_Id(deviceId, hotelId)
                .orElseThrow(() -> notFound("EBM device"));
        if (device.isActive()) {
            throw new ApiException(HttpStatus.CONFLICT, "Device already ACTIVE — re-initialization is blocked");
        }
        if (!properties.isEnabled()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "EBM is disabled. Set hms.ebm.enabled=true and EBM_KEY_ENCRYPTION_SECRET before Initialization.");
        }
        if (properties.getKeyEncryptionSecret() == null || properties.getKeyEncryptionSecret().isBlank()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Set EBM_KEY_ENCRYPTION_SECRET before storing device keys.");
        }
        try {
            Map<String, Object> response = ebmClient.initialize(device);
            applyInitResponse(device, response);
            device.setStatus("ACTIVE");
            device.setLastError(null);
            ensureCursors(device);
            return toView(deviceRepository.save(device));
        } catch (EbmApiException ex) {
            device.setStatus("ERROR");
            device.setLastError(ex.getMessage());
            deviceRepository.save(device);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "EBM Initialization failed: " + ex.getMessage());
        }
    }

    @Transactional
    public EbmDtos.DeviceView disable(UUID hotelId, String hotelHeader, UUID deviceId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        EbmDevice device = deviceRepository
                .findByIdAndHotel_Id(deviceId, hotelId)
                .orElseThrow(() -> notFound("EBM device"));
        device.setStatus("DISABLED");
        return toView(deviceRepository.save(device));
    }

    @Transactional(readOnly = true)
    public List<EbmDtos.OutboxRow> listOutbox(UUID hotelId, String hotelHeader, int limit) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        int size = Math.min(Math.max(limit, 1), 200);
        return outboxRepository.findByDevice_Hotel_IdOrderByCreatedAtDesc(hotelId, PageRequest.of(0, size)).stream()
                .map(e -> new EbmDtos.OutboxRow(
                        e.getId(),
                        e.getPhase(),
                        e.getStatus(),
                        e.getSaleEvent() != null ? e.getSaleEvent().getId() : null,
                        e.getAttempts(),
                        e.getLastError(),
                        e.getCreatedAt(),
                        e.getSubmittedAt(),
                        e.getAckedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EbmDtos.SaleEventRow> listSaleEvents(UUID hotelId, String hotelHeader, int limit) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        int size = Math.min(Math.max(limit, 1), 200);
        return saleEventRepository.findByHotel_IdOrderByCreatedAtDesc(hotelId, PageRequest.of(0, size)).stream()
                .map(e -> new EbmDtos.SaleEventRow(
                        e.getId(),
                        e.getSourceType(),
                        e.getSourceId(),
                        e.getDocumentNumber(),
                        e.getEbmStatus(),
                        e.getEbmReceiptNo(),
                        e.getCreatedAt()))
                .toList();
    }

    public EbmDevice requireActiveDevice(UUID hotelId) {
        return deviceRepository
                .findFirstByHotel_IdAndStatusOrderByCreatedAtDesc(hotelId, "ACTIVE")
                .orElse(null);
    }

    private void applyInitResponse(EbmDevice device, Map<String, Object> response) {
        Object data = response.get("data");
        Map<?, ?> map = data instanceof Map<?, ?> m ? m : response;
        Object sdc = first(map, "sdcId", "SDC_ID", "sdc_id");
        Object mrc = first(map, "mrcNo", "MRC_NO", "mrcNo", "mrc_no");
        Object key = first(map, "signKey", "signingKey", "commKey", "key");
        if (sdc != null) {
            device.setSdcId(String.valueOf(sdc));
        }
        if (mrc != null) {
            device.setMrcNo(String.valueOf(mrc));
        }
        if (key != null) {
            device.setEncryptedSigningKey(keyCrypto.encrypt(String.valueOf(key)));
        }
        // Sandbox / offline-dev: if RRA returns empty keys, keep PENDING unless fields present
        if (device.getSdcId() == null && response.containsKey("resultCd")) {
            // Some sandboxes return resultCd=000 with nested info
            Object resultCd = response.get("resultCd");
            if (resultCd != null && !"000".equals(String.valueOf(resultCd)) && !"00".equals(String.valueOf(resultCd))) {
                throw new EbmApiException(0, "Init rejected: " + response.get("resultMsg"), response);
            }
        }
    }

    private void ensureCursors(EbmDevice device) {
        for (String category : List.of("CODE_LIST", "ITEM_CLASS", "CUSTOMER", "NOTICES")) {
            if (syncCursorRepository.findByDeviceIdAndCategory(device.getId(), category).isEmpty()) {
                EbmSyncCursor c = new EbmSyncCursor();
                c.setDeviceId(device.getId());
                c.setCategory(category);
                c.setLastReqDt(null);
                syncCursorRepository.save(c);
            }
        }
    }

    private EbmDtos.DeviceView toView(EbmDevice d) {
        return new EbmDtos.DeviceView(
                d.getId(),
                d.getMode(),
                d.getTin(),
                d.getBranchId(),
                d.getDeviceSerialNo(),
                d.getSdcId(),
                d.getMrcNo(),
                d.getVsdcEndpointUrl(),
                d.getStatus(),
                d.getLastSignatureAt(),
                d.getLastError(),
                d.getEncryptedSigningKey() != null && !d.getEncryptedSigningKey().isBlank(),
                d.getCreatedAt());
    }

    private String offlineLevel(EbmDevice active) {
        if (active == null || active.getLastSignatureAt() == null) {
            return "NONE";
        }
        long hours = Duration.between(active.getLastSignatureAt(), Instant.now()).toHours();
        if (hours >= properties.getOfflineAlertHours()) {
            return "CRITICAL";
        }
        if (hours >= properties.getOfflineWarnHours()) {
            return "WARN";
        }
        return "OK";
    }

    private static Object first(Map<?, ?> map, String... keys) {
        for (String k : keys) {
            if (map.containsKey(k) && map.get(k) != null) {
                return map.get(k);
            }
        }
        return null;
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
