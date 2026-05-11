package com.hms.repository;

import com.hms.entity.ChannelRatePlan;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelRatePlanRepository extends JpaRepository<ChannelRatePlan, UUID> {

    List<ChannelRatePlan> findByConnection_Id(UUID connectionId);
}
