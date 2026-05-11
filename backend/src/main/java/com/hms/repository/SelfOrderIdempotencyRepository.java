package com.hms.repository;

import com.hms.entity.SelfOrderIdempotency;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SelfOrderIdempotencyRepository extends JpaRepository<SelfOrderIdempotency, UUID> {

    Optional<SelfOrderIdempotency> findByHotel_IdAndKeyHash(UUID hotelId, String keyHash);
}
