package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.ChargeType;
import com.hms.domain.ReservationStatus;
import com.hms.entity.Hotel;
import com.hms.entity.NightAuditRun;
import com.hms.entity.Reservation;
import com.hms.repository.HotelRepository;
import com.hms.repository.NightAuditRunRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomChargeRepository;
import com.hms.security.TenantAccessService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NightAuditService {

    private final HotelRepository hotelRepository;
    private final ReservationRepository reservationRepository;
    private final RoomChargeRepository roomChargeRepository;
    private final NightAuditRunRepository nightAuditRunRepository;
    private final ChargeService chargeService;
    private final TenantAccessService tenantAccessService;

    public NightAuditService(
            HotelRepository hotelRepository,
            ReservationRepository reservationRepository,
            RoomChargeRepository roomChargeRepository,
            NightAuditRunRepository nightAuditRunRepository,
            ChargeService chargeService,
            TenantAccessService tenantAccessService) {
        this.hotelRepository = hotelRepository;
        this.reservationRepository = reservationRepository;
        this.roomChargeRepository = roomChargeRepository;
        this.nightAuditRunRepository = nightAuditRunRepository;
        this.chargeService = chargeService;
        this.tenantAccessService = tenantAccessService;
    }

    @Scheduled(cron = "${hms.night-audit.cron:0 0 23 * * ?}")
    @Transactional
    public void runNightAuditForAllHotels() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (Hotel h : hotelRepository.findAll()) {
            runNightAuditInternal(h.getId(), today, "SYSTEM");
        }
    }

    @Transactional
    public ApiDtos.NightAuditRunResponse runNightAuditNow(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return toDto(runNightAuditInternal(hotelId, LocalDate.now(ZoneOffset.UTC), tenantAccessService.currentUser().getUsername()));
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.NightAuditRunResponse> history(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return nightAuditRunRepository.findTop30ByHotel_IdOrderByRunDateDesc(hotelId).stream().map(this::toDto).toList();
    }

    private NightAuditRun runNightAuditInternal(UUID hotelId, LocalDate runDate, String runBy) {
        NightAuditRun run = nightAuditRunRepository.findByHotel_IdAndRunDate(hotelId, runDate).orElseGet(NightAuditRun::new);
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow();
        run.setHotel(hotel);
        run.setRunDate(runDate);
        run.setRunBy(runBy != null ? runBy : "SYSTEM");
        run.setStatus("COMPLETED");

        int audited = 0;
        int posted = 0;
        BigDecimal total = BigDecimal.ZERO;
        List<String> errors = new ArrayList<>();

        List<Reservation> checkedIn =
                reservationRepository.findByHotel_IdAndStatusIn(hotelId, List.of(ReservationStatus.CHECKED_IN));
        for (Reservation r : checkedIn) {
            audited++;
            try {
                if (r.getRoom() == null) {
                    continue;
                }
                var fromTs = runDate.atStartOfDay().toInstant(ZoneOffset.UTC);
                var toTs = runDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
                long exists =
                        roomChargeRepository.countForReservationTypeBetween(r.getId(), ChargeType.ROOM_NIGHT, fromTs, toTs);
                if (exists > 0) {
                    continue;
                }
                var amount = r.getNightlyRate() != null ? r.getNightlyRate() : BigDecimal.ZERO;
                chargeService.postFolioCharge(
                        hotelId,
                        r,
                        amount,
                        "Room " + r.getRoom().getRoomNumber() + " - " + runDate,
                        ChargeType.ROOM_NIGHT,
                        "SYSTEM",
                        null);
                posted++;
                total = total.add(amount);
            } catch (Exception e) {
                errors.add("reservation=" + r.getId() + ": " + e.getMessage());
            }
        }
        run.setRoomsAudited(audited);
        run.setChargesPosted(posted);
        run.setTotalAmount(total);
        run.setCurrency(hotel.getCurrency());
        run.setErrors(errors.isEmpty() ? null : String.join("\n", errors));
        if (!errors.isEmpty()) {
            run.setStatus("COMPLETED_WITH_ERRORS");
        }
        return nightAuditRunRepository.save(run);
    }

    private ApiDtos.NightAuditRunResponse toDto(NightAuditRun run) {
        return new ApiDtos.NightAuditRunResponse(
                run.getRunDate(),
                run.getRoomsAudited() != null ? run.getRoomsAudited() : 0,
                run.getChargesPosted() != null ? run.getChargesPosted() : 0,
                run.getTotalAmount(),
                run.getStatus(),
                run.getErrors(),
                run.getRunAt(),
                run.getRunBy());
    }
}
