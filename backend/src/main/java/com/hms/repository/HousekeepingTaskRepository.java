package com.hms.repository;

import com.hms.domain.HousekeepingTaskStatus;
import com.hms.domain.HousekeepingTaskType;
import com.hms.entity.HousekeepingTask;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HousekeepingTaskRepository extends JpaRepository<HousekeepingTask, UUID> {

    List<HousekeepingTask> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    List<HousekeepingTask> findByHotel_IdAndAssignedTo_IdOrderByCreatedAtDesc(UUID hotelId, UUID assignedToId);

    List<HousekeepingTask> findByHotel_IdAndStatusOrderByCreatedAtDesc(UUID hotelId, HousekeepingTaskStatus status);

    boolean existsByHotel_IdAndRoom_IdAndTaskTypeAndStatusIn(
            UUID hotelId,
            UUID roomId,
            HousekeepingTaskType taskType,
            Collection<HousekeepingTaskStatus> statuses);

    List<HousekeepingTask> findByHotel_IdAndStatusInOrderByCreatedAtDesc(
            UUID hotelId, Collection<HousekeepingTaskStatus> statuses);

    List<HousekeepingTask> findByRoom_IdAndStatusIn(UUID roomId, Collection<HousekeepingTaskStatus> statuses);
}
