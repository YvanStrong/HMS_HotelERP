package com.hms.repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Native reads against {@code guest_stay} view for hotel guest analytics.
 */
@Repository
public class GuestStayAnalyticsRepository {

    private final JdbcTemplate jdbc;

    public GuestStayAnalyticsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record NationalityCountRow(String nationality, long count) {}

    public record StayKpiRow(
            long totalStays,
            long noShows,
            long nonCancelledStays,
            BigDecimal avgNights,
            long distinctGuests,
            long vipGuestCount,
            long repeatGuestCount,
            BigDecimal periodRevenue) {}

    public record MonthBookingCountRow(LocalDate monthStart, long bookingCount) {}

    public List<NationalityCountRow> nationalityCounts(UUID hotelId, LocalDate from, LocalDate to) {
        String sql =
                """
                select nationality, count(*)::bigint as cnt
                from guest_stay
                where hotel_id = ?::uuid
                  and check_in >= ?::date
                  and check_in <= ?::date
                group by nationality
                order by cnt desc
                """;
        return jdbc.query(sql, (rs, rowNum) -> new NationalityCountRow(rs.getString("nationality"), rs.getLong("cnt")), hotelId, from, to);
    }

    public StayKpiRow stayKpis(UUID hotelId, LocalDate from, LocalDate to) {
        String sql =
                """
                select
                  count(*)::bigint as total_stays,
                  count(*) filter (where status = 'NO_SHOW')::bigint as no_shows,
                  count(*) filter (where status <> 'CANCELLED')::bigint as non_cancelled_stays,
                  coalesce(avg(nights) filter (where status <> 'CANCELLED'), 0) as avg_nights,
                  count(distinct guest_id)::bigint as distinct_guests,
                  count(distinct guest_id) filter (where vip_flag)::bigint as vip_guests,
                  count(distinct guest_id) filter (where is_repeat)::bigint as repeat_guests,
                  coalesce(sum(stay_revenue) filter (where status <> 'CANCELLED'), 0) as period_revenue
                from guest_stay
                where hotel_id = ?::uuid
                  and check_in >= ?::date
                  and check_in <= ?::date
                """;
        return jdbc.queryForObject(sql, stayKpiRowMapper(), hotelId, from, to);
    }

    private RowMapper<StayKpiRow> stayKpiRowMapper() {
        return (ResultSet rs, int rowNum) -> new StayKpiRow(
                rs.getLong("total_stays"),
                rs.getLong("no_shows"),
                rs.getLong("non_cancelled_stays"),
                rs.getBigDecimal("avg_nights") != null ? rs.getBigDecimal("avg_nights") : BigDecimal.ZERO,
                rs.getLong("distinct_guests"),
                rs.getLong("vip_guests"),
                rs.getLong("repeat_guests"),
                rs.getBigDecimal("period_revenue") != null ? rs.getBigDecimal("period_revenue") : BigDecimal.ZERO);
    }

    /**
     * For guests who checked in at least once in the report window, average of each guest's
     * all-time non-cancelled stay revenue at this hotel (folio / reservation totals).
     */
    public BigDecimal averageGuestLifetimeValue(UUID hotelId, LocalDate from, LocalDate to) {
        String sql =
                """
                with period_guests as (
                  select distinct guest_id
                  from guest_stay
                  where hotel_id = ?::uuid
                    and check_in >= ?::date
                    and check_in <= ?::date
                )
                select coalesce(avg(s.tot), 0) as avg_ltv
                from (
                  select gs.guest_id, sum(gs.stay_revenue) as tot
                  from guest_stay gs
                  join period_guests pg on pg.guest_id = gs.guest_id
                  where gs.hotel_id = ?::uuid
                    and gs.status <> 'CANCELLED'
                  group by gs.guest_id
                ) s
                """;
        BigDecimal v = jdbc.queryForObject(sql, BigDecimal.class, hotelId, from, to, hotelId);
        return v != null ? v : BigDecimal.ZERO;
    }

    /**
     * Repeat-visit bookings per calendar month (check-in month), inclusive range on {@code check_in}.
     */
    public List<MonthBookingCountRow> repeatBookingsByMonth(UUID hotelId, LocalDate trendFromInclusive, LocalDate trendToInclusive) {
        String sql =
                """
                select date_trunc('month', check_in)::date as month_start, count(*)::bigint as booking_count
                from guest_stay
                where hotel_id = ?::uuid
                  and is_repeat = true
                  and check_in >= ?::date
                  and check_in <= ?::date
                group by 1
                order by 1
                """;
        return jdbc.query(
                sql,
                (rs, rowNum) -> {
                    Date d = rs.getDate("month_start");
                    LocalDate ms = d != null ? d.toLocalDate() : null;
                    return new MonthBookingCountRow(ms, rs.getLong("booking_count"));
                },
                hotelId,
                trendFromInclusive,
                trendToInclusive);
    }

    /** Pads missing months with zero counts for charting. */
    public List<MonthBookingCountRow> repeatBookingsTrendLast12Months(UUID hotelId, LocalDate trendTo) {
        LocalDate trendFromInclusive = trendTo.withDayOfMonth(1).minusMonths(11);
        List<MonthBookingCountRow> raw = repeatBookingsByMonth(hotelId, trendFromInclusive, trendTo);
        Map<LocalDate, Long> byMonth = new LinkedHashMap<>();
        for (MonthBookingCountRow r : raw) {
            if (r.monthStart() != null) {
                byMonth.put(r.monthStart(), r.bookingCount());
            }
        }
        List<MonthBookingCountRow> out = new ArrayList<>();
        LocalDate cursor = trendTo.withDayOfMonth(1).minusMonths(11);
        for (int i = 0; i < 12; i++) {
            LocalDate key = cursor.plusMonths(i);
            out.add(new MonthBookingCountRow(key, byMonth.getOrDefault(key, 0L)));
        }
        return out;
    }
}
