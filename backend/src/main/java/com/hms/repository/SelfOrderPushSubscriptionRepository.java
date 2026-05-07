package com.hms.repository;

import com.hms.entity.SelfOrderPushSubscription;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SelfOrderPushSubscriptionRepository extends JpaRepository<SelfOrderPushSubscription, UUID> {

    List<SelfOrderPushSubscription> findByTrackToken(UUID trackToken);

    @Modifying
    @Query("delete from SelfOrderPushSubscription s where s.trackToken = :trackToken and s.endpoint = :endpoint")
    void deleteByTrackTokenAndEndpoint(
            @Param("trackToken") UUID trackToken, @Param("endpoint") String endpoint);

    long countByTrackToken(UUID trackToken);

    List<SelfOrderPushSubscription> findByTrackTokenOrderByCreatedAtAsc(UUID trackToken);
}
