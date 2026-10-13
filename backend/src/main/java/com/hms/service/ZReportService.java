package com.hms.service;

import com.hms.api.dto.ZReportDtos;
import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.entity.CompanyObligation;
import com.hms.entity.Hotel;
import com.hms.repository.AccountingExpenseRepository;
import com.hms.repository.AppUserRepository;
import com.hms.repository.CompanyObligationRepository;
import com.hms.repository.DepotSaleRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.InvSalesInvoiceRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ZReportService {

    private final TenantAccessService tenantAccessService;
    private final HotelRepository hotelRepository;
    private final DepotSaleRepository depotSaleRepository;
    private final InvSalesInvoiceRepository invoiceRepository;
    private final AccountingExpenseRepository expenseRepository;
    private final CompanyObligationRepository obligationRepository;
    private final AppUserRepository appUserRepository;
    private final JavaMailSender mailSender;

    @Value("${hms.notifications.email.enabled:true}")
    private boolean emailEnabled;

    @Value("${hms.notifications.email.from:}")
    private String fromAddress;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${hms.zreport.boss-email:}")
    private String configuredBossEmail;

    public ZReportService(
            TenantAccessService tenantAccessService,
            HotelRepository hotelRepository,
            DepotSaleRepository depotSaleRepository,
            InvSalesInvoiceRepository invoiceRepository,
            AccountingExpenseRepository expenseRepository,
            CompanyObligationRepository obligationRepository,
            AppUserRepository appUserRepository,
            JavaMailSender mailSender) {
        this.tenantAccessService = tenantAccessService;
        this.hotelRepository = hotelRepository;
        this.depotSaleRepository = depotSaleRepository;
        this.invoiceRepository = invoiceRepository;
        this.expenseRepository = expenseRepository;
        this.obligationRepository = obligationRepository;
        this.appUserRepository = appUserRepository;
        this.mailSender = mailSender;
    }

    @Transactional(readOnly = true)
    public ZReportDtos.ZReport preview(
            UUID hotelId, String hotelHeader, LocalDate date, LocalDate fromDate, LocalDate toDate) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return build(hotelId, date, fromDate, toDate);
    }

    @Transactional(readOnly = true)
    public byte[] pdf(UUID hotelId, String hotelHeader, LocalDate date, LocalDate fromDate, LocalDate toDate) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        return renderPdf(build(hotelId, date, fromDate, toDate));
    }

    @Transactional(readOnly = true)
    public ZReportDtos.ZReportEmailResult email(
            UUID hotelId, String hotelHeader, LocalDate date, LocalDate fromDate, LocalDate toDate) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        if (!emailEnabled || mailUsername == null || mailUsername.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Email is not set up on the server yet.");
        }
        ZReportDtos.ZReport report = build(hotelId, date, fromDate, toDate);
        if (report.bossEmails().isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Add an email on the hotel, or on a hotel admin user, so the Z Report has somewhere to go.");
        }
        byte[] pdf = renderPdf(report);
        String from = fromAddress != null && !fromAddress.isBlank() ? fromAddress : mailUsername;
        String subject = "Z Report " + periodLabel(report) + " — " + report.hotelName();
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(report.bossEmails().toArray(String[]::new));
            helper.setSubject(subject);
            helper.setText(plainBody(report), htmlBody(report));
            helper.addAttachment(
                    pdfFilename(report),
                    new org.springframework.core.io.ByteArrayResource(pdf),
                    "application/pdf");
            mailSender.send(message);
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not send the Z Report email.");
        }
        return new ZReportDtos.ZReportEmailResult(
                report.bossEmails(), "Z Report emailed to " + String.join(", ", report.bossEmails()));
    }

    private ZReportDtos.ZReport build(UUID hotelId, LocalDate date, LocalDate fromDate, LocalDate toDate) {
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        LocalDate[] period = resolvePeriod(hotel, date, fromDate, toDate);
        LocalDate fromDay = period[0];
        LocalDate toDay = period[1];
        Instant from = fromDay.atStartOfDay(zone(hotel)).toInstant();
        Instant to = toDay.plusDays(1).atStartOfDay(zone(hotel)).toInstant();
        BigDecimal posSales = money(depotSaleRepository.sumCompletedSalesBetween(hotelId, from, to));
        BigDecimal invoiceSales = money(invoiceRepository.sumRecognizedRevenue(hotelId, fromDay, toDay));
        BigDecimal creditSales = money(depotSaleRepository.sumCreditSalesBetween(hotelId, from, to));
        BigDecimal totalSales = money(posSales.add(invoiceSales));
        BigDecimal expenses = money(expenseRepository.sumExpenses(hotelId, fromDay, toDay));
        BigDecimal cogs = money(safe(depotSaleRepository.sumCompletedCostBetween(hotelId, from, to))
                .add(safe(invoiceRepository.sumRecognizedCost(hotelId, fromDay, toDay))));
        BigDecimal gross = money(totalSales.subtract(cogs));
        BigDecimal net = money(gross.subtract(expenses));
        BigDecimal credit = BigDecimal.ZERO;
        BigDecimal debt = BigDecimal.ZERO;
        for (CompanyObligation row : obligationRepository.findByHotel_IdOrderByEntryDateDescCreatedAtDesc(hotelId)) {
            if (!"OPEN".equals(row.getStatus()) || row.getAmount() == null) continue;
            if ("CREDIT".equals(row.getKind())) credit = credit.add(row.getAmount());
            else if ("DEBT".equals(row.getKind())) debt = debt.add(row.getAmount());
        }
        String name = hotel.getCompanyName() != null && !hotel.getCompanyName().isBlank()
                ? hotel.getCompanyName().trim()
                : hotel.getName();
        return new ZReportDtos.ZReport(
                fromDay,
                fromDay,
                toDay,
                name,
                hotel.getCurrency() == null || hotel.getCurrency().isBlank() ? "RWF" : hotel.getCurrency(),
                totalSales,
                expenses,
                cogs,
                gross,
                net,
                money(credit),
                money(debt),
                posSales,
                invoiceSales,
                creditSales,
                bossEmails(hotel));
    }

    private static LocalDate[] resolvePeriod(Hotel hotel, LocalDate date, LocalDate fromDate, LocalDate toDate) {
        LocalDate today = LocalDate.now(zone(hotel));
        LocalDate from = fromDate != null ? fromDate : (date != null ? date : today);
        LocalDate to = toDate != null ? toDate : (fromDate != null ? fromDate : from);
        if (to.isBefore(from)) {
            LocalDate swap = from;
            from = to;
            to = swap;
        }
        if (ChronoUnit.DAYS.between(from, to) > 366) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Z Report date range cannot exceed 366 days.");
        }
        return new LocalDate[] {from, to};
    }

    private static String periodLabel(ZReportDtos.ZReport report) {
        if (report.fromDate() == null || report.toDate() == null || report.fromDate().equals(report.toDate())) {
            return String.valueOf(report.businessDate());
        }
        return report.fromDate() + " to " + report.toDate();
    }

    private static String periodLine(ZReportDtos.ZReport report) {
        if (report.fromDate() == null || report.toDate() == null || report.fromDate().equals(report.toDate())) {
            return "Business date: " + report.businessDate();
        }
        return "Period: " + report.fromDate() + " to " + report.toDate();
    }

    private static String pdfFilename(ZReportDtos.ZReport report) {
        if (report.fromDate() == null || report.toDate() == null || report.fromDate().equals(report.toDate())) {
            return "z-report-" + report.businessDate() + ".pdf";
        }
        return "z-report-" + report.fromDate() + "-to-" + report.toDate() + ".pdf";
    }

    private List<String> bossEmails(Hotel hotel) {
        Set<String> emails = new LinkedHashSet<>();
        if (configuredBossEmail != null && !configuredBossEmail.isBlank()) {
            emails.add(configuredBossEmail.trim());
        }
        if (hotel.getEmail() != null && !hotel.getEmail().isBlank()) {
            emails.add(hotel.getEmail().trim());
        }
        for (AppUser user : appUserRepository.findByHotel_IdAndRoleIn(hotel.getId(), List.of(Role.HOTEL_ADMIN))) {
            if (user.isActive() && user.getEmail() != null && !user.getEmail().isBlank()) {
                emails.add(user.getEmail().trim());
            }
        }
        return new ArrayList<>(emails);
    }

    private static ZoneId zone(Hotel hotel) {
        try {
            return ZoneId.of(hotel.getTimezone() == null || hotel.getTimezone().isBlank() ? "UTC" : hotel.getTimezone());
        } catch (Exception ex) {
            return ZoneId.of("UTC");
        }
    }

    private static BigDecimal safe(BigDecimal n) {
        return n == null ? BigDecimal.ZERO : n;
    }

    private static BigDecimal money(BigDecimal n) {
        return safe(n).setScale(2, RoundingMode.HALF_UP);
    }

    private byte[] renderPdf(ZReportDtos.ZReport report) {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream content = new PDPageContentStream(doc, page);
            float y = 780;
            y = line(content, bold, 18, 50, y, "Z REPORT");
            y = line(content, bold, 12, 50, y - 8, sanitize(report.hotelName()));
            y = line(content, regular, 11, 50, y - 6, periodLine(report));
            y -= 16;
            y = line(content, regular, 12, 50, y, "POS sales: " + amount(report.currency(), report.posSales()));
            y = line(content, regular, 12, 50, y, "Inventory invoices: " + amount(report.currency(), report.inventorySales()));
            y = line(content, bold, 12, 50, y, "Total sales: " + amount(report));
            y = line(content, regular, 12, 50, y, "Still on credit (included above): " + amount(report.currency(), report.creditSales()));
            y = line(content, regular, 12, 50, y, "Cost of goods: " + amount(report.currency(), report.costOfGoods()));
            y = line(content, bold, 12, 50, y - 4, "Gross profit: " + amount(report.currency(), report.grossProfit()));
            y = line(content, regular, 12, 50, y, "Total expenses: " + amount(report.currency(), report.totalExpenses()));
            y = line(content, bold, 12, 50, y, "Net profit: " + amount(report.currency(), report.netProfit()));
            y -= 10;
            y = line(content, regular, 12, 50, y, "Credit (owed to the company): " + amount(report.currency(), report.openCredit()));
            y = line(content, regular, 12, 50, y, "Debt (the company owes): " + amount(report.currency(), report.openDebt()));
            y -= 16;
            line(content, regular, 9, 50, y, "Credit and debt are the open balances, not only this period.");
            content.close();
            doc.save(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not build the Z Report PDF.");
        }
    }

    private static String amount(ZReportDtos.ZReport report) {
        return amount(report.currency(), report.totalSales());
    }

    private static String amount(String currency, BigDecimal value) {
        return currency + " " + money(value).toPlainString();
    }

    private static float line(PDPageContentStream content, PDType1Font font, float size, float x, float y, String text)
            throws java.io.IOException {
        content.beginText();
        content.setFont(font, size);
        content.newLineAtOffset(x, y);
        content.showText(sanitize(text));
        content.endText();
        return y - 22;
    }

    private static String sanitize(String text) {
        if (text == null) return "";
        return text.replaceAll("[^\\x20-\\x7E]", "?");
    }

    private static String plainBody(ZReportDtos.ZReport report) {
        return """
                Z Report for %s
                %s

                POS sales: %s
                Inventory invoices: %s
                Total sales: %s
                Still on credit: %s
                Cost of goods: %s
                Gross profit (sales minus cost): %s
                Total expenses: %s
                Net profit (gross minus expenses): %s
                Open credit: %s
                Open debt: %s

                The PDF is attached.
                """
                .formatted(
                        report.hotelName(),
                        periodLabel(report),
                        amount(report.currency(), report.posSales()),
                        amount(report.currency(), report.inventorySales()),
                        amount(report),
                        amount(report.currency(), report.creditSales()),
                        amount(report.currency(), report.costOfGoods()),
                        amount(report.currency(), report.grossProfit()),
                        amount(report.currency(), report.totalExpenses()),
                        amount(report.currency(), report.netProfit()),
                        amount(report.currency(), report.openCredit()),
                        amount(report.currency(), report.openDebt()));
    }

    private static String htmlBody(ZReportDtos.ZReport report) {
        return """
                <p><strong>Z Report</strong> for %s<br>%s</p>
                <p>POS sales: %s<br>Inventory invoices: %s<br>Total sales: %s<br>Still on credit: %s<br>
                Cost of goods: %s<br>Gross profit: %s<br>Expenses: %s<br>Net profit: %s<br>
                Open credit: %s<br>Open debt: %s</p>
                <p>The PDF is attached.</p>
                """
                .formatted(
                        esc(report.hotelName()),
                        periodLabel(report),
                        esc(amount(report.currency(), report.posSales())),
                        esc(amount(report.currency(), report.inventorySales())),
                        esc(amount(report)),
                        esc(amount(report.currency(), report.creditSales())),
                        esc(amount(report.currency(), report.costOfGoods())),
                        esc(amount(report.currency(), report.grossProfit())),
                        esc(amount(report.currency(), report.totalExpenses())),
                        esc(amount(report.currency(), report.netProfit())),
                        esc(amount(report.currency(), report.openCredit())),
                        esc(amount(report.currency(), report.openDebt())));
    }

    private static String esc(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
