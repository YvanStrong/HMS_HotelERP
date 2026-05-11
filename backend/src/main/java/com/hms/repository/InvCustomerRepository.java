package com.hms.repository;

import com.hms.entity.InvCustomer;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvCustomerRepository extends JpaRepository<InvCustomer, UUID> {
    List<InvCustomer> findByHotel_IdAndActiveTrueOrderByNameAsc(UUID hotelId);
    Optional<InvCustomer> findByIdAndHotel_Id(UUID id, UUID hotelId);
}
