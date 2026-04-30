package com.hms.service;

import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.Payment;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

@Service
public class InvoicePdfService {

    public byte[] renderInvoicePdf(
            Reservation reservation,
            List<RoomCharge> charges,
            List<Payment> payments,
            BigDecimal subtotal,
            BigDecimal tax,
            BigDecimal discount,
            BigDecimal grandTotal,
            BigDecimal paymentsTotal,
            BigDecimal balanceDue) {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = 806;
                final float left = 44;
                final float right = 552;
                DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
                Hotel h = reservation.getHotel();
                Guest g = reservation.getGuest();
                String currency = h != null && h.getCurrency() != null ? h.getCurrency() : "USD";

                y = text(cs, left, y, 18, true, "TAX INVOICE");
                y = text(cs, left, y - 2, 12, true, nvl(h.getName()));
                y = text(cs, left, y, 9, false, nvl(h.getAddress()));
                y = text(cs, left, y, 9, false, "Phone: " + nvl(h.getPhone()) + "   Email: " + nvl(h.getEmail()));

                textRight(cs, right, 806, 9, true, "Invoice No: INV-" + nvl(reservation.getBookingReference()));
                textRight(cs, right, 792, 9, false, "Issued: " + dtf.format(java.time.Instant.now().atOffset(ZoneOffset.UTC)));
                textRight(cs, right, 778, 9, false, "Status: " + reservation.getStatus());
                drawLine(cs, left, right, 768);
                y = 752;

                y = text(cs, left, y, 10, true, "Bill To");
                y = text(cs, left, y, 9, false, nvl(g.getFullName()));
                y = text(cs, left, y, 9, false, "National ID/Passport: " + nvl(g.getNationalId()));
                y = text(cs, left, y, 9, false, "Address: " + joinAddress(g));

                y += 12;
                y = text(cs, left, y, 10, true, "Reservation");
                y = text(cs, left, y, 9, false, "Reference: " + nvl(reservation.getBookingReference()));
                y = text(
                        cs,
                        left,
                        y,
                        9,
                        false,
                        "Room: " + (reservation.getRoom() != null ? reservation.getRoom().getRoomNumber() : "Unassigned")
                                + "   Stay: " + reservation.getCheckInDate() + " to " + reservation.getCheckOutDate());

                y -= 3;
                drawLine(cs, left, right, y);
                y -= 12;

                y = text(cs, left, y, 10, true, "Charges");
                y = text(cs, left, y, 8, true, "Date        Description                                      Amount");
                for (RoomCharge c : charges) {
                    y = text(
                            cs,
                            left,
                            y,
                            8,
                            false,
                            c.getChargedAt().atOffset(ZoneOffset.UTC).toLocalDate()
                                    + "   " + truncate(nvl(c.getDescription()), 45)
                                    + padTo(48, truncate(nvl(c.getDescription()), 45))
                                    + money(c.getAmount(), currency));
                    if (y < 230) break;
                }
                y = text(cs, left, y - 10, 10, true, "Payments");
                y = text(cs, left, y, 8, true, "Date        Method           Reference                    Amount");
                for (Payment p : payments) {
                    y = text(
                            cs,
                            left,
                            y,
                            8,
                            false,
                            p.getProcessedAt().atOffset(ZoneOffset.UTC).toLocalDate()
                                    + "   " + padTo(15, nvl(p.getMethod()))
                                    + padTo(28, truncate(nvl(p.getReference()), 24))
                                    + money(p.getAmount(), currency));
                    if (y < 170) break;
                }

                float summaryTop = Math.max(y - 8, 122);
                drawLine(cs, left, right, summaryTop);
                textRight(cs, right, summaryTop - 14, 9, false, "Subtotal: " + money(subtotal, currency));
                textRight(cs, right, summaryTop - 28, 9, false, "VAT (18%): " + money(tax, currency));
                textRight(cs, right, summaryTop - 42, 9, false, "Discounts: " + money(discount, currency));
                textRight(cs, right, summaryTop - 56, 10, true, "Grand Total: " + money(grandTotal, currency));
                textRight(cs, right, summaryTop - 72, 9, false, "Total Paid: " + money(paymentsTotal, currency));
                textRight(cs, right, summaryTop - 88, 11, true, "Balance Due: " + money(balanceDue, currency));

                text(cs, left, 62, 8, false, "Thank you for staying with us.");
                text(
                        cs,
                        left,
                        48,
                        8,
                        false,
                        "Generated: " + dtf.format(java.time.Instant.now().atOffset(ZoneOffset.UTC))
                                + "   Booking Ref: " + nvl(reservation.getBookingReference()));
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate invoice PDF", e);
        }
    }

    private static float text(PDPageContentStream cs, float x, float y, int size, boolean bold, String value) throws Exception {
        cs.beginText();
        cs.setFont(
                bold
                        ? new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD)
                        : new PDType1Font(Standard14Fonts.FontName.HELVETICA),
                size);
        cs.newLineAtOffset(x, y);
        cs.showText(value != null ? value : "");
        cs.endText();
        return y - (size + 3);
    }

    private static void textRight(PDPageContentStream cs, float rightX, float y, int size, boolean bold, String value) throws Exception {
        float approxWidth = (value != null ? value.length() : 0) * (size * 0.48f);
        text(cs, rightX - approxWidth, y, size, bold, value);
    }

    private static void drawLine(PDPageContentStream cs, float x1, float x2, float y) throws Exception {
        cs.moveTo(x1, y);
        cs.lineTo(x2, y);
        cs.stroke();
    }

    private static String money(BigDecimal amount, String currency) {
        BigDecimal v = amount != null ? amount : BigDecimal.ZERO;
        return v.setScale(2, RoundingMode.HALF_UP) + " " + nvl(currency);
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        if (value.length() <= max) return value;
        return value.substring(0, Math.max(0, max - 1)) + "…";
    }

    private static String padTo(int width, String value) {
        String v = nvl(value);
        if (v.length() >= width) return v + " ";
        return v + " ".repeat(width - v.length());
    }

    private static String joinAddress(Guest g) {
        return String.join(
                ", ",
                List.of(nvl(g.getStreetNumber()), nvl(g.getVillage()), nvl(g.getCell()), nvl(g.getSector()), nvl(g.getDistrict()), nvl(g.getProvince()), nvl(g.getCountry())));
    }

    private static String nvl(String s) {
        return s == null || s.isBlank() ? "-" : s;
    }
}
