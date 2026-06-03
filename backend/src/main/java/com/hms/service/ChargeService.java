package com.hms.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.api.dto.ApiDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.ReservationStatus;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomChargeRepository;
import com.hms.security.TenantAccessService;
import com.hms.security.UserPrincipal;
import com.hms.service.folio.FolioLedgerService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChargeService {

    private final ReservationRepository reservationRepository;
    private final RoomChargeRepository roomChargeRepository;
    private final TenantAccessService tenantAccessService;
    private final ObjectMapper objectMapper;
    private final FolioLedgerService folioLedgerService;
    private final GroupBillingRouter groupBillingRouter;

    public ChargeService(
            ReservationRepository reservationRepository,
            RoomChargeRepository roomChargeRepository,
            TenantAccessService tenantAccessService,
            ObjectMapper objectMapper,
            FolioLedgerService folioLedgerService,
            GroupBillingRouter groupBillingRouter) {
        this.reservationRepository = reservationRepository;
        this.roomChargeRepository = roomChargeRepository;
        this.tenantAccessService = tenantAccessService;
        this.objectMapper = objectMapper;
        this.folioLedgerService = folioLedgerService;
        this.groupBillingRouter = groupBillingRouter;
    }

    @Transactional
    public ApiDtos.PostChargeResponse postCharge(
            UUID hotelId, String hotelHeader, UUID roomId, ApiDtos.PostChargeRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        Reservation r = reservationRepository
                .findByIdAndHotel_IdWithGroupBilling(req.reservationId(), hotelId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "No reservation with this id for this hotel. Use the reservation id from POST .../reservations "
                                + "after check-in; reservationId in the body must exist and the URL roomId must be that reservation's assigned room."));
        if (r.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Charges can only be posted for CHECKED_IN reservations. Current status: "
                            + r.getStatus()
                            + ". Call POST .../reservations/{id}/check-in first.");
        }
        if (r.getRoom() == null || !r.getRoom().getId().equals(roomId)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "URL roomId does not match this reservation's assigned room. Use the room id from the reservation "
                            + "(Create reservation returns `room.id`); do not use a different physical room.");
        }
        UserPrincipal user = tenantAccessService.currentUser();
        ChargeType chargeType = ChargeType.valueOf(req.type().trim().toUpperCase());
        Reservation target = groupBillingRouter.resolveFolioReservation(r, chargeType);

        BigDecimal priorConsumption = roomChargeRepository.sumAmountForReservation(target.getId());
        BigDecimal previousTotalPreTax =
                target.getTotalAmount().add(priorConsumption).setScale(2, java.math.RoundingMode.HALF_UP);

        RoomCharge c = new RoomCharge();
        c.setReservation(target);
        c.setRoom(r.getRoom());
        if (!target.getId().equals(r.getId())) {
            c.setOriginatingReservation(r);
        }
        c.setDescription(req.description());
        c.setAmount(req.amount().setScale(2, java.math.RoundingMode.HALF_UP));
        c.setQuantity(req.quantity() != null ? req.quantity() : 1);
        c.setChargeType(chargeType);
        c.setPostedBy(req.postedBy() != null ? req.postedBy() : user.getUsername());
        if (req.metadata() != null && !req.metadata().isEmpty()) {
            try {
                c.setMetadataJson(objectMapper.writeValueAsString(req.metadata()));
                Object sku = req.metadata().get("productSku");
                if (sku != null && !sku.toString().isBlank()) {
                    c.setProductSku(sku.toString().trim());
                }
            } catch (JsonProcessingException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid metadata");
            }
        }
        c.setChargedAt(Instant.now());
        c = roomChargeRepository.save(c);
        folioLedgerService.onRoomChargePosted(c);

        BigDecimal consumption = roomChargeRepository.sumAmountForReservation(target.getId());
        BigDecimal running = target.getTotalAmount().add(consumption).setScale(2, java.math.RoundingMode.HALF_UP);
        String posted = c.getPostedBy() != null ? c.getPostedBy() : user.getUsername();
        UUID billingOrig = target.getId().equals(r.getId()) ? null : r.getId();
        return new ApiDtos.PostChargeResponse(
                c.getId(),
                target.getId(),
                r.getRoom().getRoomNumber(),
                c.getDescription(),
                c.getAmount(),
                c.getQuantity(),
                c.getChargeType().name(),
                new ApiDtos.PostChargePostedBy(posted, posted),
                new ApiDtos.PostChargeFolioSnapshot(previousTotalPreTax, running),
                running,
                c.getChargedAt(),
                null,
                billingOrig);
    }

    /**
     * Internal: post a folio charge for an already CHECKED_IN reservation (recreation, minibar from inventory, etc.).
     */
    @Transactional
    public RoomCharge postFolioCharge(
            UUID hotelId,
            Reservation reservation,
            BigDecimal amount,
            String description,
            ChargeType chargeType,
            String postedBy,
            String metadataJson) {
        return postFolioCharge(hotelId, reservation, amount, description, chargeType, postedBy, metadataJson, null);
    }

    @Transactional
    public RoomCharge postFolioCharge(
            UUID hotelId,
            Reservation reservation,
            BigDecimal amount,
            String description,
            ChargeType chargeType,
            String postedBy,
            String metadataJson,
            String productSku) {
        if (!reservation.getHotel().getId().equals(hotelId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Reservation hotel mismatch");
        }
        if (reservation.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Charges can only be posted for CHECKED_IN reservations. Current status: " + reservation.getStatus());
        }
        boolean eventFolio =
                reservation.getBookingSource() != null
                        && "GROUP_EVENT_FOLIO".equalsIgnoreCase(reservation.getBookingSource().trim());
        if (reservation.getRoom() == null && !eventFolio) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Reservation has no room assigned");
        }
        Reservation orig = reservationRepository
                .findByIdAndHotel_IdWithGroupBilling(reservation.getId(), hotelId)
                .orElse(reservation);
        Reservation target = groupBillingRouter.resolveFolioReservation(orig, chargeType);

        RoomCharge c = new RoomCharge();
        c.setReservation(target);
        c.setRoom(orig.getRoom());
        if (!target.getId().equals(orig.getId())) {
            c.setOriginatingReservation(orig);
        }
        c.setDescription(description);
        c.setAmount(amount.setScale(2, java.math.RoundingMode.HALF_UP));
        c.setQuantity(1);
        c.setChargeType(chargeType);
        c.setPostedBy(postedBy != null ? postedBy : tenantAccessService.currentUser().getUsername());
        c.setMetadataJson(metadataJson);
        if (productSku != null && !productSku.isBlank()) {
            c.setProductSku(productSku.trim());
        }
        c.setChargedAt(Instant.now());
        c = roomChargeRepository.save(c);
        folioLedgerService.onRoomChargePosted(c);
        return c;
    }
}
