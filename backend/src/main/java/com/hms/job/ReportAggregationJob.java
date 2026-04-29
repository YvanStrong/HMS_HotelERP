package com.hms.job;

import com.hms.entity.DailyRevenueSnapshot;
import com.hms.entity.Hotel;
import com.hms.repository.DailyRevenueSnapshotRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InvoiceRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ReportAggregationJob {

    private final HotelRepository hotelRepository;
    private final InvoiceRepository invoiceRepository;
    private final DailyRevenueSnapshotRepository dailyRevenueSnapshotRepository;

    public ReportAggregationJob(
            HotelRepository hotelRepository,
            InvoiceRepository invoiceRepository,
            DailyRevenueSnapshotRepository dailyRevenueSnapshotRepository) {
        this.hotelRepository = hotelRepository;
        this.invoiceRepository = invoiceRepository;
        this.dailyRevenueSnapshotRepository = dailyRevenueSnapshotRepository;
    }

    /** Persists invoice totals per hotel for the previous UTC day (read model seed for finance dashboards). */
    @Scheduled(cron = "0 0 2 * * *", zone = "UTC")
    @Transactional
    public void aggregateDailyRevenue() {
        LocalDate day = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        Instant start = day.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        for (Hotel h : hotelRepository.findAll()) {
            BigDecimal sum = invoiceRepository.sumTotalAmountByHotelAndCreatedAtRange(h.getId(), start, end);
            long cnt = invoiceRepository.countByHotelAndCreatedAtRange(h.getId(), start, end);
            DailyRevenueSnapshot snap = dailyRevenueSnapshotRepository
                    .findByHotel_IdAndSummaryDate(h.getId(), day)
                    .orElseGet(DailyRevenueSnapshot::new);
            snap.setHotel(h);
            snap.setSummaryDate(day);
            snap.setInvoiceTotal(sum);
            snap.setInvoiceCount((int) cnt);
            snap.setAggregatedAt(Instant.now());
            dailyRevenueSnapshotRepository.save(snap);
        }
    }
}
