package com.hms.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
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
}
