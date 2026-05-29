package com.hms.repository;

import com.hms.domain.ModuleTier;
import com.hms.entity.PlatformModule;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformModuleRepository extends JpaRepository<PlatformModule, UUID> {
    List<PlatformModule> findByLocked(boolean locked);

    List<PlatformModule> findByTier(ModuleTier tier);

    Optional<PlatformModule> findByModuleKey(String key);

    List<PlatformModule> findByModuleKeyIn(List<String> keys);

    List<PlatformModule> findAllByActiveTrueOrderBySortOrderAsc();

    List<PlatformModule> findAllByOrderBySortOrderAsc();
}
