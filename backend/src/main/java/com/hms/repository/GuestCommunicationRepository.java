package com.hms.repository;

import com.hms.entity.GuestCommunication;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuestCommunicationRepository extends JpaRepository<GuestCommunication, UUID> {

    List<GuestCommunication> findByGuest_IdOrderByCreatedAtDesc(UUID guestId);
}
