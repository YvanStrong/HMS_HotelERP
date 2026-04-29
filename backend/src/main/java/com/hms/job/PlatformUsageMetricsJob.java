package com.hms.job;

import com.hms.entity.PlatformTenant;
import com.hms.entity.PlatformUsageMetric;
import com.hms.repository.AppUserRepository;
import com.hms.repository.PlatformTenantRepository;
import com.hms.repository.PlatformUsageMetricRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PlatformUsageMetricsJob {

    private final PlatformTenantRepository platformTenantRepository;
    private final PlatformUsageMetricRepository platformUsageMetricRepository;
    private final RoomRepository roomRepository;
    private final AppUserRepository appUserRepository;
    private final ReservationRepository reservationRepository;

    public PlatformUsageMetricsJob(
            PlatformTenantRepository platformTenantRepository,
            PlatformUsageMetricRepository platformUsageMetricRepository,
            RoomRepository roomRepository,
            AppUserRepository appUserRepository,
            ReservationRepository reservationRepository) {
        this.platformTenantRepository = platformTenantRepository;
        this.platformUsageMetricRepository = platformUsageMetricRepository;
        this.roomRepository = roomRepository;
        this.appUserRepository = appUserRepository;
        this.reservationRepository = reservationRepository;
    }

    @Scheduled(cron = "${hms.usage-metrics.cron:0 45 1 * * *}")
    @Transactional
    public void snapshotUtcDaily() {
        LocalDate metricDate = LocalDate.now(ZoneOffset.UTC);
        YearMonth ym = YearMonth.from(metricDate);
        Instant start = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        for (PlatformTenant t : platformTenantRepository.findAll()) {
            UUID hid = t.getId();
            int rooms = (int) Math.min(Integer.MAX_VALUE, roomRepository.countByHotel_Id(hid));
            int users = (int) Math.min(Integer.MAX_VALUE, appUserRepository.countByHotel_Id(hid));
            int res = (int) Math.min(Integer.MAX_VALUE, reservationRepository.countByHotel_IdAndCreatedAtBetween(hid, start, end));
            PlatformUsageMetric row = platformUsageMetricRepository
                    .findByTenantIdAndMetricDate(hid, metricDate)
                    .orElseGet(PlatformUsageMetric::new);
            if (row.getId() == null) {
                row.setTenantId(hid);
                row.setMetricDate(metricDate);
            }
            row.setActiveRooms(rooms);
            row.setActiveUsers(users);
            row.setReservationsCreated(res);
            row.setApiCalls(null);
            row.setStorageUsedMB(null);
            row.setBandwidthUsedGB(null);
            platformUsageMetricRepository.save(row);
        }
    }
}
