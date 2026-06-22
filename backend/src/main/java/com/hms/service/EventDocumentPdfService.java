package com.hms.service;

import com.hms.api.dto.EventBookingDtos;
import com.hms.api.dto.EventOpsDtos;
import com.hms.domain.EventBillingDocumentType;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

@Service
public class EventDocumentPdfService {

    private static final float LEFT = 44f;
    private static final float RIGHT = 552f;
    private static final float MID = 300f;
    private static final float BOTTOM = 72f;
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public byte[] renderBillingDocumentPdf(
            EventOpsDtos.PrintableQuoteResponse data,
            EventBillingDocumentType documentType,
            String documentNumber,
            BigDecimal amountPaid,
            BigDecimal balanceDue) {
        try (PDDocument doc = new PDDocument()) {
            PageWriter pw = new PageWriter(doc);
            EventOpsDtos.QuoteResponse quote = data.quote();
            EventBookingDtos.EventBookingResponse event = data.event();
            String currency = nvl(data.currency());
            String title = documentTitle(documentType);

            pw.textRight(RIGHT, 806f, 9, false, ascii(documentNumber));
            pw.title(data.hotelName(), title);
            if (data.hotelAddress() != null && !data.hotelAddress().isBlank()) {
                pw.line(data.hotelAddress());
            }
            String hotelContact = joinParts(" | ", data.hotelPhone(), data.hotelEmail());
            if (!hotelContact.isBlank()) {
                pw.line(hotelContact);
            }
            pw.rule();

            pw.twoColumnSection(
                    "Function",
                    List.of(
                            "Event: " + event.eventName(),
                            "When: " + formatDt(event.startDatetime()) + " to " + formatDt(event.endDatetime()),
                            "Venue: " + nvl(event.venueName()),
                            "Guests: " + guestCount(event)),
                    "Prepared for",
                    List.of(
                            data.groupName(),
                            companyLine(data.companyName()),
                            "Contact: " + nvl(data.contactPerson()),
                            joinParts(" | ", data.contactEmail(), data.contactPhone())));
            pw.gap(10);

            pw.bold("Line items");
            pw.drawTableHeader(new float[] {LEFT, 300f, 360f, 430f}, new String[] {
                "Description", "Qty", "Unit", "Total"
            });
            for (EventOpsDtos.QuoteLineResponse line : quote.lines()) {
                pw.drawTableRow(
                        new float[] {LEFT, 300f, 360f, 430f, RIGHT},
                        new String[] {
                            truncate(line.description(), 38),
                            moneyQty(line.quantity()),
                            money(line.unitPrice(), currency),
                            money(line.lineTotal(), currency)
                        },
                        new int[] {0, 2, 2, 2});
            }
            pw.gap(8);

            pw.textAt(340f, "Subtotal", money(quote.subtotal(), currency), false);
            pw.textAt(340f, "Tax", money(quote.taxAmount(), currency), false);
            pw.textAt(340f, "Discount", "-" + money(quote.discountAmount(), currency), false);
            pw.textAt(340f, "Total", money(quote.totalAmount(), currency), true);
            pw.textAt(340f, "Amount paid", money(amountPaid, currency), false);
            pw.textAt(340f, "Balance due", money(balanceDue, currency), true);
            pw.textAt(340f, "Deposit required", money(quote.depositRequired(), currency)
                    + (quote.depositPaid() ? " (paid)" : ""), false);

            if (quote.validUntil() != null) {
                pw.line("Valid until: " + quote.validUntil());
            }
            if (quote.clientNotes() != null && !quote.clientNotes().isBlank()) {
                pw.gap(6);
                pw.bold("Notes to client");
                pw.wrap(quote.clientNotes());
            }

            pw.footer(documentFooter(documentType) + " Generated " + DT.format(LocalDateTime.now()));
            return pw.bytes();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate event billing PDF", e);
        }
    }

    public byte[] renderBeoPdf(EventOpsDtos.FullBeoResponse data) {
        try (PDDocument doc = new PDDocument()) {
            PageWriter pw = new PageWriter(doc);
            EventOpsDtos.BeoResponse beo = data.beo();
            EventBookingDtos.EventBookingResponse event = data.event();
            String currency = data.quote() != null && data.quote().totalAmount() != null ? "" : "";

            pw.title("BANQUET ORDER", event.eventName());
            pw.line("Internal operations sheet - not for guest distribution");
            pw.rule();

            pw.twoColumnSection(
                    "Function details",
                    List.of(
                            "Event: " + event.eventName(),
                            "When: " + formatDt(event.startDatetime()) + " to " + formatDt(event.endDatetime()),
                            "Venue: " + nvl(event.venueName()),
                            "Setup: " + nvl(beo.setupStyle()),
                            "Expected: " + pax(beo.expectedPax()) + "  Guaranteed: " + pax(beo.guaranteedPax())),
                    "Group / contact",
                    List.of(
                            data.groupName(),
                            "Contact: " + nvl(data.contactPerson()),
                            joinParts(" | ", data.contactEmail(), data.contactPhone()),
                            "Version: v" + beo.version(),
                            "Status: " + (beo.status() != null ? beo.status().name() : "-")));
            pw.gap(8);

            pw.bold("Catering");
            pw.drawTableHeader(new float[] {LEFT, 320f, 460f}, new String[] {"Item", "Qty", "Total"});
            for (EventOpsDtos.CateringLineResponse line : data.cateringLines()) {
                pw.drawTableRow(
                        new float[] {LEFT, 320f, 460f, RIGHT},
                        new String[] {truncate(line.description(), 48), moneyQty(line.quantity()), money(line.lineTotal(), currency)},
                        new int[] {0, 2, 2});
            }
            if (beo.menuNotes() != null && !beo.menuNotes().isBlank()) {
                pw.gap(4);
                pw.bold("Menu notes");
                pw.wrap(beo.menuNotes());
            }
            pw.gap(8);

            pw.twoColumnSection(
                    "Kitchen instructions",
                    wrapToLines(beo.kitchenNotes(), 44),
                    "Housekeeping instructions",
                    wrapToLines(beo.housekeepingNotes(), 44));

            if (data.quote() != null) {
                EventOpsDtos.QuoteResponse quote = data.quote();
                pw.gap(8);
                pw.bold("Finance summary");
                pw.line("Contract total: " + money(quote.totalAmount(), currency));
                pw.line("Tax: " + money(quote.taxAmount(), currency));
                pw.line("Deposit: " + money(quote.depositRequired(), currency)
                        + (quote.depositPaid() ? " (confirmed)" : ""));
                pw.line("Deposit confirmed on banquet order: " + (beo.depositConfirmed() ? "Yes" : "No"));
                if (quote.chargesPostedAt() != null) {
                    pw.line("Charges posted to group folio: Yes");
                }
            }

            pw.gap(12);
            pw.line("Banquet manager / date: ________________________________");
            pw.line("Client signature / date: ________________________________");
            pw.line("Hotel representative / date: __________________________");
            pw.footer("Generated " + DT.format(LocalDateTime.now()));
            return pw.bytes();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate banquet order PDF", e);
        }
    }

    private static String documentTitle(EventBillingDocumentType type) {
        return switch (type) {
            case INVOICE -> "TAX INVOICE";
            case PROFORMA -> "PROFORMA INVOICE";
            case DELIVERY -> "DELIVERY NOTE";
        };
    }

    private static String documentFooter(EventBillingDocumentType type) {
        return switch (type) {
            case INVOICE -> "Thank you for your business.";
            case PROFORMA -> "Partial payment received. Balance remains due on the group guest bill.";
            case DELIVERY -> "No payment received yet. Services are scheduled per the group contract.";
        };
    }

    private static String companyLine(String company) {
        if (company == null || company.isBlank()) return "Company: -";
        return "Company: " + company;
    }

    private static String guestCount(EventBookingDtos.EventBookingResponse event) {
        if (event.guaranteedPax() != null) return event.guaranteedPax() + " guaranteed";
        if (event.expectedPax() != null) return event.expectedPax() + " expected";
        return "-";
    }

    private static List<String> wrapToLines(String text, int maxChars) {
        if (text == null || text.isBlank()) return List.of("-");
        return wrapLines(text, maxChars);
    }

    private static String formatDt(LocalDateTime dt) {
        return dt != null ? DT.format(dt) : "-";
    }

    private static String pax(Integer n) {
        return n != null ? String.valueOf(n) : "-";
    }

    private static String money(BigDecimal amount, String currency) {
        BigDecimal v = amount != null ? amount : BigDecimal.ZERO;
        String cur = currency != null && !currency.isBlank() ? " " + currency.trim() : "";
        return v.setScale(2, RoundingMode.HALF_UP).toPlainString() + cur;
    }

    private static String moneyQty(BigDecimal qty) {
        BigDecimal v = qty != null ? qty : BigDecimal.ZERO;
        return v.stripTrailingZeros().scale() <= 0
                ? v.toBigInteger().toString()
                : v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        if (value.length() <= max) return value;
        return value.substring(0, Math.max(0, max - 3)) + "...";
    }

    private static String nvl(String s) {
        return s == null || s.isBlank() ? "-" : s;
    }

    private static String joinParts(String sep, String... parts) {
        StringBuilder b = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            if (b.length() > 0) b.append(sep);
            b.append(p.trim());
        }
        return b.toString();
    }

    private static String ascii(String s) {
        if (s == null) return "";
        return s.replace('\u2014', '-')
                .replace('\u2013', '-')
                .replace('\u2192', '-')
                .replace('\u00b7', '|')
                .replace('\u2022', '-')
                .replace('\u201c', '"')
                .replace('\u201d', '"')
                .replace('\u2018', '\'')
                .replace('\u2019', '\'');
    }

    private static String pdfSafe(String s) {
        if (s == null || s.isEmpty()) return "";
        String n = Normalizer.normalize(ascii(s), Normalizer.Form.NFKD).replaceAll("\\p{M}+", "");
        StringBuilder b = new StringBuilder(Math.min(n.length(), 4000));
        for (int i = 0; i < n.length(); i++) {
            char c = n.charAt(i);
            if (c == '\t' || c == '\n' || c == '\r') {
                b.append(' ');
            } else if (c >= 32 && c <= 126) {
                b.append(c);
            } else if (Character.isWhitespace(c)) {
                b.append(' ');
            } else {
                b.append('?');
            }
        }
        return b.toString();
    }

    private static List<String> wrapLines(String text, int maxChars) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isBlank()) {
            out.add("-");
            return out;
        }
        for (String paragraph : text.split("\\R")) {
            String p = paragraph.trim();
            if (p.isEmpty()) continue;
            while (p.length() > maxChars) {
                int breakAt = p.lastIndexOf(' ', maxChars);
                if (breakAt < 20) breakAt = maxChars;
                out.add(p.substring(0, breakAt).trim());
                p = p.substring(breakAt).trim();
            }
            if (!p.isEmpty()) out.add(p);
        }
        if (out.isEmpty()) out.add("-");
        return out;
    }

    private final class PageWriter {
        private final PDDocument doc;
        private PDPageContentStream cs;
        private float y = 806f;

        PageWriter(PDDocument doc) throws Exception {
            this.doc = doc;
            newPage();
        }

        void newPage() throws Exception {
            if (cs != null) cs.close();
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            cs = new PDPageContentStream(doc, page);
            y = 806f;
        }

        void ensureSpace(float needed) throws Exception {
            if (y - needed < BOTTOM) newPage();
        }

        void title(String main, String sub) throws Exception {
            ensureSpace(40);
            y = text(LEFT, y, 16, true, main);
            if (sub != null && !sub.isBlank()) {
                y = text(LEFT, y, 12, true, sub);
            }
        }

        void bold(String value) throws Exception {
            ensureSpace(14);
            y = text(LEFT, y, 10, true, value);
        }

        void line(String value) throws Exception {
            ensureSpace(12);
            y = text(LEFT, y, 9, false, value);
        }

        void wrap(String value) throws Exception {
            for (String row : wrapLines(value, 92)) {
                ensureSpace(12);
                y = text(LEFT, y, 9, false, row);
            }
        }

        void gap(float pts) {
            y -= pts;
        }

        void rule() throws Exception {
            ensureSpace(10);
            y -= 6;
            drawLine(LEFT, RIGHT, y);
            y -= 10;
        }

        void twoColumnSection(String leftTitle, List<String> leftLines, String rightTitle, List<String> rightLines)
                throws Exception {
            ensureSpace(80);
            float startY = y;
            text(LEFT, startY, 10, true, leftTitle);
            float ly = startY - 14;
            for (String row : leftLines) {
                if (row == null || row.isBlank()) continue;
                text(LEFT, ly, 9, false, row);
                ly -= 12;
            }
            text(MID, startY, 10, true, rightTitle);
            float ry = startY - 14;
            for (String row : rightLines) {
                if (row == null || row.isBlank()) continue;
                text(MID, ry, 9, false, row);
                ry -= 12;
            }
            y = Math.min(ly, ry) - 4;
        }

        void drawTableHeader(float[] xs, String[] labels) throws Exception {
            ensureSpace(16);
            for (int i = 0; i < labels.length; i++) {
                text(xs[i], y, 8, true, labels[i]);
            }
            drawLine(LEFT, RIGHT, y - 4);
            y -= 14;
        }

        void drawTableRow(float[] xs, String[] values, int[] align) throws Exception {
            ensureSpace(14);
            for (int i = 0; i < values.length; i++) {
                String v = values[i];
                if (align[i] == 2) {
                    float rightAnchor = (i + 1 < xs.length) ? xs[i + 1] : RIGHT;
                    textRight(rightAnchor - 4, y, 8, false, v);
                } else {
                    text(xs[i], y, 8, false, v);
                }
            }
            y -= 12;
        }

        void textAt(float labelX, String label, String value, boolean boldValue) throws Exception {
            ensureSpace(14);
            text(labelX, y, 9, false, label + ":");
            textRight(RIGHT, y, 9, boldValue, value);
            y -= 12;
        }

        void textRight(float rightX, float atY, int size, boolean bold, String value) throws Exception {
            String v = pdfSafe(value != null ? value : "");
            float approxWidth = v.length() * (size * 0.48f);
            text(rightX - approxWidth, atY, size, bold, v);
        }

        void footer(String value) throws Exception {
            ensureSpace(20);
            y = Math.max(y, 56);
            text(LEFT, 48, 8, false, value);
        }

        byte[] bytes() throws Exception {
            cs.close();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }

        private float text(float x, float atY, int size, boolean bold, String value) throws Exception {
            cs.beginText();
            cs.setFont(
                    bold
                            ? new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD)
                            : new PDType1Font(Standard14Fonts.FontName.HELVETICA),
                    size);
            cs.newLineAtOffset(x, atY);
            cs.showText(pdfSafe(value != null ? value : ""));
            cs.endText();
            return atY - (size + 3);
        }

        private void drawLine(float x1, float x2, float yPos) throws Exception {
            cs.moveTo(x1, yPos);
            cs.lineTo(x2, yPos);
            cs.stroke();
        }
    }
}
