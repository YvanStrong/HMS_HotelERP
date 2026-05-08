package com.hms.repository;

import com.hms.entity.ApiKey;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

    List<ApiKey> findByHotel_IdOrderByCreatedAtDesc(UUID hotelId);

    Optional<ApiKey> findByKeyHash(String keyHash);
}
