package com.hms.repository;

import com.hms.entity.GuestFeedback;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuestFeedbackRepository extends JpaRepository<GuestFeedback, UUID> {

    long countByGuest_Id(UUID guestId);
}
