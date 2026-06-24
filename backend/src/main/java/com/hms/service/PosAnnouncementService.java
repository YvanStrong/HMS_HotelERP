package com.hms.service;

import com.hms.api.dto.MobilePosDtos;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.entity.InventoryDepot;
import com.hms.entity.PosAnnouncement;
import com.hms.entity.PosAnnouncementRead;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InventoryDepotRepository;
import com.hms.repository.PosAnnouncementReadRepository;
import com.hms.repository.PosAnnouncementRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PosAnnouncementService {

    private final TenantAccessService tenantAccessService;
    private final PosAnnouncementRepository announcementRepository;
    private final PosAnnouncementReadRepository readRepository;
    private final HotelRepository hotelRepository;
    private final InventoryDepotRepository depotRepository;
    private final AppUserRepository appUserRepository;
    private final PushNotificationService pushNotificationService;

    @Transactional
    public MobilePosDtos.AnnouncementRow create(
            UUID hotelId, String hotelHeader, MobilePosDtos.CreateAnnouncementRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> notFound("Hotel"));
        AppUser author = appUserRepository.findById(userId).orElseThrow(() -> notFound("User"));

        InventoryDepot depot = null;
        if (req.depotId() != null) {
            depot = depotRepository
                    .findByIdAndHotel_Id(req.depotId(), hotelId)
                    .orElseThrow(() -> notFound("Depot"));
        }

        String type = normalizeType(req.type());
        PosAnnouncement row = new PosAnnouncement();
        row.setHotel(hotel);
        row.setDepot(depot);
        row.setMessage(req.message().trim());
        row.setType(type);
        row.setCreatedBy(author);
        row.setExpiresAt(req.expiresAt());
        row.setActive(true);
        row = announcementRepository.save(row);

        String depotName = depot != null ? depot.getName() : "All outlets";
        Map<String, String> data = new HashMap<>();
        data.put("type", "POS_ANNOUNCEMENT");
        data.put("announcementId", row.getId().toString());
        if (depot != null) {
            pushNotificationService.sendToDepotStaff(
                    hotelId, depot.getId(), "POS Announcement", row.getMessage(), data);
        } else {
            for (InventoryDepot d : depotRepository.findByHotel_IdOrderByNameAsc(hotelId)) {
                pushNotificationService.sendToDepotStaff(
                        hotelId, d.getId(), "POS Announcement", row.getMessage(), data);
            }
        }

        return toRow(row, depotName);
    }

    @Transactional(readOnly = true)
    public List<MobilePosDtos.AnnouncementRow> activeUnread(
            UUID hotelId, String hotelHeader, UUID depotId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        return announcementRepository.findUnreadForUser(hotelId, depotId, userId, Instant.now()).stream()
                .map(a -> toRow(a, depotLabel(a)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MobilePosDtos.AnnouncementRow> listActive(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return announcementRepository.findActiveForHotel(hotelId, Instant.now()).stream()
                .map(a -> toRow(a, depotLabel(a)))
                .toList();
    }

    @Transactional
    public void markRead(UUID hotelId, String hotelHeader, UUID announcementId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        UUID userId = tenantAccessService.currentUser().getId();
        announcementRepository
                .findByIdAndHotel_Id(announcementId, hotelId)
                .orElseThrow(() -> notFound("Announcement"));
        if (readRepository.existsByAnnouncementIdAndUserId(announcementId, userId)) {
            return;
        }
        PosAnnouncementRead read = new PosAnnouncementRead();
        read.setAnnouncementId(announcementId);
        read.setUserId(userId);
        readRepository.save(read);
    }

    @Transactional
    public void deactivate(UUID hotelId, String hotelHeader, UUID announcementId) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        PosAnnouncement row = announcementRepository
                .findByIdAndHotel_Id(announcementId, hotelId)
                .orElseThrow(() -> notFound("Announcement"));
        row.setActive(false);
        announcementRepository.save(row);
    }

    private static String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "INFO";
        }
        String u = type.trim().toUpperCase(Locale.ROOT);
        return switch (u) {
            case "WARNING", "URGENT" -> u;
            default -> "INFO";
        };
    }

    private static String depotLabel(PosAnnouncement a) {
        return a.getDepot() != null ? a.getDepot().getName() : "All outlets";
    }

    private static MobilePosDtos.AnnouncementRow toRow(PosAnnouncement a, String depotName) {
        return new MobilePosDtos.AnnouncementRow(
                a.getId(),
                a.getMessage(),
                a.getType(),
                a.getDepot() != null ? a.getDepot().getId() : null,
                depotName,
                a.getCreatedAt(),
                a.getExpiresAt());
    }

    private static ApiException notFound(String entity) {
        return new ApiException(HttpStatus.NOT_FOUND, entity + " not found");
    }
}
