package com.hms.repository;

import com.hms.entity.PricingRule;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PricingRuleRepository extends JpaRepository<PricingRule, UUID> {

    List<PricingRule> findByHotel_IdAndActiveTrueOrderByPriorityDesc(UUID hotelId);

    List<PricingRule> findByHotel_IdOrderByPriorityDesc(UUID hotelId);
}
