package com.hms.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ZReportDtos {

    private ZReportDtos() {}

    public record ZReport(
            LocalDate businessDate,
            LocalDate fromDate,
            LocalDate toDate,
            String hotelName,
            String currency,
            BigDecimal totalSales,
            BigDecimal totalExpenses,
            BigDecimal costOfGoods,
            BigDecimal grossProfit,
            BigDecimal netProfit,
            BigDecimal openCredit,
            BigDecimal openDebt,
            BigDecimal posSales,
            BigDecimal inventorySales,
            BigDecimal creditSales,
            List<String> bossEmails) {}

    public record ZReportEmailResult(List<String> sentTo, String message) {}
}
