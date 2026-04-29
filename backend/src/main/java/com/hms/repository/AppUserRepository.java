package com.hms.repository;

import com.hms.domain.Role;
import com.hms.entity.AppUser;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    long countByHotel_Id(UUID hotelId);

    @Query("select u from AppUser u left join fetch u.hotel where u.username = :username")
    Optional<AppUser> findByUsername(@Param("username") String username);

    @Query("select u from AppUser u left join fetch u.hotel where lower(u.email) = lower(:email)")
    Optional<AppUser> findByEmailIgnoreCase(@Param("email") String email);

    @Query("select u from AppUser u where u.hotel.id = :hotelId and u.role in :roles")
    List<AppUser> findByHotel_IdAndRoleIn(@Param("hotelId") UUID hotelId, @Param("roles") Collection<Role> roles);
}
