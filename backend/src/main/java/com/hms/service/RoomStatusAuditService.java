package com.hms.service;

import com.hms.domain.CleanlinessStatus;
import com.hms.domain.RoomStatus;
import com.hms.entity.Room;
import com.hms.entity.RoomStatusLog;
import com.hms.repository.RoomStatusLogRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomStatusAuditService {

    private final RoomStatusLogRepository roomStatusLogRepository;

    public RoomStatusAuditService(RoomStatusLogRepository roomStatusLogRepository) {
        this.roomStatusLogRepository = roomStatusLogRepository;
    }

    @Transactional
    public void logTransition(
            UUID hotelId,
            Room room,
            RoomStatus previousStatus,
            RoomStatus newStatus,
            CleanlinessStatus previousCleanliness,
            CleanlinessStatus newCleanliness,
            String actor,
            String reason,
            UUID changedByUserId) {
        boolean sameStatus = java.util.Objects.equals(previousStatus, newStatus);
        boolean sameClean = java.util.Objects.equals(previousCleanliness, newCleanliness);
        if (sameStatus && sameClean && (reason == null || !reason.contains("DND"))) {
            return;
        }
        RoomStatusLog row = new RoomStatusLog();
        row.setHotelId(hotelId);
        row.setRoomId(room.getId());
        row.setRoomNumber(room.getRoomNumber());
        row.setPreviousStatus(previousStatus != null ? previousStatus.name() : null);
        row.setNewStatus(newStatus != null ? newStatus.name() : null);
        row.setPreviousCleanliness(previousCleanliness != null ? previousCleanliness.name() : null);
        row.setNewCleanliness(newCleanliness != null ? newCleanliness.name() : null);
        row.setActor(actor != null ? actor : "system");
        row.setChangedByUserId(changedByUserId);
        row.setReason(reason);
        roomStatusLogRepository.save(row);
    }

    /** Backward-compatible overload without actor user id. */
    public void logTransition(
            UUID hotelId,
            Room room,
            RoomStatus previousStatus,
            RoomStatus newStatus,
            CleanlinessStatus previousCleanliness,
            CleanlinessStatus newCleanliness,
            String actor,
            String reason) {
        logTransition(
                hotelId, room, previousStatus, newStatus, previousCleanliness, newCleanliness, actor, reason, null);
    }
}
