package com.hms.repository;

import com.hms.entity.PlatformBusinessCategory;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlatformBusinessCategoryRepository extends JpaRepository<PlatformBusinessCategory, UUID> {
    Optional<PlatformBusinessCategory> findByCode(String code);

    List<PlatformBusinessCategory> findAllByActiveTrueOrderByNameAsc();

    @Query("select distinct c from PlatformBusinessCategory c left join fetch c.modules where c.id = :id")
    Optional<PlatformBusinessCategory> findByIdWithModules(@Param("id") UUID id);

    @Query("select distinct c from PlatformBusinessCategory c left join fetch c.modules where c.active = true order by c.name asc")
    List<PlatformBusinessCategory> findAllActiveWithModules();
}
