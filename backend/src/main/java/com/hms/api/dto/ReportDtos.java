package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public final class ReportDtos {

    private ReportDtos() {}

    public record ReportPeriod(LocalDate start, LocalDate end, String groupBy) {}

    public record OccupancyReportResponse(
            String reportType,
            UUID hotelId,
            ReportPeriod period,
            Map<String, Object> summary,
            List<Map<String, Object>> data,
            Map<String, String> exportOptions) {}

    public record GuestAnalyticsResponse(
            String reportType,
            Map<String, Object> filters,
            Map<String, Object> summary,
            List<Map<String, Object>> insights,
            List<Map<String, Object>> segments,
            String exportUrl) {}

    public record RealtimeDashboardResponse(
            String timestamp,
            UUID hotelId,
            Map<String, Object> liveMetrics,
            List<Map<String, Object>> alerts,
            List<Map<String, Object>> quickActions) {}

    public record ExecutiveKpiCard(
            String key, String title, BigDecimal value, String valueDisplay, String tone, String subtext, String actionPath) {}

    public record ExecutiveArrivalRow(
            UUID reservationId, String bookingReference, String guestName, String roomNumber, Instant checkInTime, String status) {}

    public record ExecutiveDepartureRow(
            UUID reservationId, String bookingReference, String guestName, String roomNumber, BigDecimal balanceDue, String status) {}

    public record ExecutiveActivityRow(Instant timestamp, String staffName, String action, String reference) {}

    public record ExecutiveDashboardResponse(
            String timestamp,
            UUID hotelId,
            List<ExecutiveKpiCard> todaysOperations,
            List<ExecutiveKpiCard> revenueCards,
            List<ExecutiveKpiCard> operationsAlerts,
            List<ExecutiveArrivalRow> todaysArrivals,
            List<ExecutiveDepartureRow> todaysDepartures,
            List<ExecutiveActivityRow> recentActivity) {}

    public record ComplaintsByTypeRow(String type, long count) {}

    public record ComplaintsByStaffRow(
            @JsonProperty("staff_user_id") UUID staffUserId,
            @JsonProperty("staff_username") String staffUsername,
            long count) {}

    public record ComplaintsMetricsResponse(
            @JsonProperty("period_start") Instant periodStart,
            @JsonProperty("average_resolution_hours") Double averageResolutionHours,
            @JsonProperty("by_type") List<ComplaintsByTypeRow> byType,
            @JsonProperty("by_staff") List<ComplaintsByStaffRow> byStaff,
            @JsonProperty("total_in_range") long totalInRange) {}

    public record GuestNationalitySlice(String nationality, long count, BigDecimal percent) {}

    public record GuestRepeatBookingsMonth(String month, long repeatBookingCount) {}

    public record GuestDashboardDocumentation(
            String averageGuestLifetimeValueMeaning,
            String revenuePerGuestMeaning,
            String noShowRateDenominator,
            String staySelectionCriteria,
            String repeatBookingTrendWindow) {}

    public record GuestDashboardResponse(
            String reportType,
            UUID hotelId,
            LocalDate fromDate,
            LocalDate toDate,
            List<GuestNationalitySlice> nationalityDistribution,
            long repeatGuestCount,
            List<GuestRepeatBookingsMonth> repeatBookingTrendLast12Months,
            long vipGuestCount,
            BigDecimal noShowRatePercent,
            BigDecimal averageStayNights,
            BigDecimal averageGuestLifetimeValue,
            String averageGuestLifetimeValueNote,
            BigDecimal revenuePerGuest,
            String revenuePerGuestNote,
            GuestDashboardDocumentation documentation) {}

    public record TabularReportResponse(
            String reportType,
            UUID hotelId,
            LocalDate fromDate,
            LocalDate toDate,
            Map<String, Object> summary,
            List<String> columns,
            List<Map<String, Object>> rows) {}
}
