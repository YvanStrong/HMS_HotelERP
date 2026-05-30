package com.hms.repository;

import com.hms.entity.HotelModuleEntitlement;
import com.hms.entity.HotelModuleEntitlementId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HotelModuleEntitlementRepository
        extends JpaRepository<HotelModuleEntitlement, HotelModuleEntitlementId> {

    @Query("select e from HotelModuleEntitlement e join fetch e.module where e.hotel.id = :hotelId")
    List<HotelModuleEntitlement> findByHotelId(@Param("hotelId") UUID hotelId);

    @Query("select e from HotelModuleEntitlement e join fetch e.module where e.hotel.id = :hotelId and e.enabled = :enabled")
    List<HotelModuleEntitlement> findByHotelIdAndEnabled(@Param("hotelId") UUID hotelId, @Param("enabled") boolean enabled);

    @Query(
            """
            select count(e) > 0 from HotelModuleEntitlement e
            where e.hotel.id = :hotelId
            and e.module.moduleKey = :key
            and e.enabled = :enabled
            and e.billingStatus <> com.hms.domain.ModuleBillingStatus.SUSPENDED
            """)
    boolean existsByHotelIdAndModuleKeyAndEnabled(
            @Param("hotelId") UUID hotelId, @Param("key") String key, @Param("enabled") boolean enabled);

    @Query("select e from HotelModuleEntitlement e where e.hotel.id = :hotelId and e.module.moduleKey = :key")
    Optional<HotelModuleEntitlement> findByHotelIdAndModuleKey(@Param("hotelId") UUID hotelId, @Param("key") String key);

    @Modifying
    @Query("delete from HotelModuleEntitlement e where e.hotel.id = :hotelId")
    void deleteByHotelId(@Param("hotelId") UUID hotelId);

    @Modifying
    @Query("delete from HotelModuleEntitlement e where e.hotel.id = :hotelId and e.module.locked = false and e.module.tier <> com.hms.domain.ModuleTier.ADDON")
    void deleteNonCoreNonAddonByHotelId(@Param("hotelId") UUID hotelId);
}
