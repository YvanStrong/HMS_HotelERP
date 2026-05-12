package com.hms.repository;

import com.hms.entity.GuestDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuestDocumentRepository extends JpaRepository<GuestDocument, UUID> {

    List<GuestDocument> findByGuest_IdOrderByCreatedAtDesc(UUID guestId);

    Optional<GuestDocument> findByIdAndGuest_Id(UUID id, UUID guestId);
}
