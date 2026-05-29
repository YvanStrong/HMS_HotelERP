package com.hms.repository;

import com.hms.entity.Hotel;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HotelRepository extends JpaRepository<Hotel, UUID> {

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    @Query("select h from Hotel h left join fetch h.businessCategory where h.id = :id")
    Optional<Hotel> findByIdWithBusinessCategory(@Param("id") UUID id);
}
