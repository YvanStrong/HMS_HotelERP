package com.hms.repository;

import com.hms.entity.MenuItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {

    Optional<MenuItem> findByIdAndOutlet_Id(UUID id, UUID outletId);

    List<MenuItem> findByOutlet_IdOrderByNameAsc(UUID outletId);

    boolean existsByOutlet_IdAndCodeIgnoreCase(UUID outletId, String code);
}
