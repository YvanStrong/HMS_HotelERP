package com.hms.repository;

import com.hms.entity.FacilityAbonnement;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FacilityAbonnementRepository extends JpaRepository<FacilityAbonnement, UUID> {

    Optional<FacilityAbonnement> findByIdAndHotel_Id(UUID id, UUID hotelId);

    Optional<FacilityAbonnement> findByHotel_IdAndCodeIgnoreCase(UUID hotelId, String code);

    @Query(
            """
            select distinct a from FacilityAbonnement a
            left join fetch a.allowedFacilities af
            left join fetch af.facility
            where a.hotel.id = :hotelId
            order by a.createdAt desc
            """)
    List<FacilityAbonnement> findDetailedByHotelId(@Param("hotelId") UUID hotelId);

    @Query(
            """
            select distinct a from FacilityAbonnement a
            left join fetch a.allowedFacilities af
            left join fetch af.facility
            where a.hotel.id = :hotelId
              and (
                lower(a.code) like lower(concat('%', :q, '%'))
                or lower(a.memberName) like lower(concat('%', :q, '%'))
                or lower(coalesce(a.companyName, '')) like lower(concat('%', :q, '%'))
              )
            order by a.createdAt desc
            """)
    List<FacilityAbonnement> searchDetailed(@Param("hotelId") UUID hotelId, @Param("q") String q);
}
