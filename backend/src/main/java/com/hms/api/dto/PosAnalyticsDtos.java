package com.hms.api.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class PosAnalyticsDtos {

    private PosAnalyticsDtos() {}

    public record SummaryResponse(
            BigDecimal totalRevenue,
            int totalOrders,
            BigDecimal avgTicketValue,
            long avgServeTimeMinutes,
            int totalCovers,
            Map<String, BigDecimal> revenueByPaymentMethod,
            List<DepotSlice> revenueByDepot) {}

    public record DepotSlice(String depotName, BigDecimal revenue, int orders) {}

    public record HourlySlot(int hour, BigDecimal revenue, int orders) {}

    public record TopItemRow(String productName, int qtySold, BigDecimal revenue, BigDecimal avgOrdersPerDay) {}

    public record WaiterRow(
            String waiterName,
            int ordersCount,
            BigDecimal revenue,
            BigDecimal avgTicketValue,
            long avgServeTimeMin) {}

    public record TableRow(
            String tableLabel,
            int totalOrders,
            BigDecimal totalRevenue,
            long avgOccupancyMinutes,
            int turnoverCount) {}

    public record DailyRevenueRow(String date, BigDecimal revenue, int orders) {}
}
