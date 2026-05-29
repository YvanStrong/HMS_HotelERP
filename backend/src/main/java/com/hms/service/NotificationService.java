package com.hms.service;

import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.entity.Notification;
import com.hms.entity.Reservation;
import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.hms.repository.NotificationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void queueBookingConfirmationEmail(Reservation reservation) {
        try {
            Guest g = reservation.getGuest();
            Hotel h = reservation.getHotel();
            if (g.getEmail() == null || g.getEmail().isBlank()) {
                return;
            }
            Notification n = new Notification();
            n.setHotel(h);
            n.setType("BOOKING_CONFIRMATION");
            n.setChannel("EMAIL");
            n.setRecipientType("GUEST");
            n.setRecipientId(g.getId());
            n.setRecipientAddress(g.getEmail().trim());
            n.setSubject("Booking confirmed — " + reservation.getBookingReference());
            n.setBody(buildBookingConfirmationBody(reservation, g, h));
            n.setStatus("PENDING");
            n.setScheduledFor(java.time.Instant.now());
            n.setReferenceType("RESERVATION");
            n.setReferenceId(reservation.getId());
            notificationRepository.save(n);
        } catch (RuntimeException e) {
            log.warn("Could not queue booking confirmation: {}", e.getMessage());
        }
    }

    private static String buildBookingConfirmationBody(Reservation reservation, Guest guest, Hotel hotel) {
        long nights = ChronoUnit.DAYS.between(reservation.getCheckInDate(), reservation.getCheckOutDate());
        String currency = hotel.getCurrency() != null ? hotel.getCurrency() : "";
        String roomNumber = reservation.getRoom() != null ? reservation.getRoom().getRoomNumber() : "To be assigned";
        String roomType = reservation.getRoom() != null && reservation.getRoom().getRoomType() != null
                ? reservation.getRoom().getRoomType().getName()
                : "Room";
        BigDecimal deposit = reservation.isDepositPaid() && reservation.getDepositAmount() != null
                ? reservation.getDepositAmount()
                : BigDecimal.ZERO;
        String guests = reservation.getAdults() + " adult" + (reservation.getAdults() == 1 ? "" : "s");
        if (reservation.getChildren() != null && reservation.getChildren() > 0) {
            guests += ", " + reservation.getChildren() + " child" + (reservation.getChildren() == 1 ? "" : "ren");
        }
        String depositLine = deposit + " " + currency
                + (reservation.getDepositPaymentMethod() != null ? " via " + reservation.getDepositPaymentMethod() : "");
        String requests = reservation.getSpecialRequests() != null && !reservation.getSpecialRequests().isBlank()
                ? infoRow("Special requests", reservation.getSpecialRequests().trim())
                : "";
        String hero = """
                      <div style="margin-top:24px;padding:18px;border-radius:22px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);">
                        <div style="font-size:13px;opacity:.78;">Booking reference</div>
                        <div style="font-size:30px;font-weight:900;letter-spacing:.04em;">%s</div>
                        <div style="font-size:13px;margin-top:4px;opacity:.82;">Confirmation code: %s</div>
                      </div>
                """.formatted(esc(reservation.getBookingReference()), esc(reservation.getConfirmationCode()));
        String content = """
                      <p style="font-size:17px;line-height:1.65;margin:0 0 20px;">Dear <strong>%s</strong>, your stay is reserved. Below is your booking snapshot.</p>
                      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 18px;">
                        %s
                        %s
                        %s
                        %s
                      </div>
                      <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:22px;padding:18px;margin:18px 0;">
                        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#1d4ed8;font-weight:900;">Price summary</div>
                        <div style="margin-top:12px;display:grid;gap:10px;">
                          %s
                          %s
                          %s
                        </div>
                      </div>
                      <div style="border:1px solid #e2e8f0;border-radius:22px;padding:18px;margin:18px 0;">
                        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#64748b;font-weight:900;">Guest details received</div>
                        <div style="margin-top:12px;display:grid;gap:10px;">
                          %s
                          %s
                          %s
                          %s
                          %s
                        </div>
                      </div>
                      %s
                      <div style="margin-top:20px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;padding:16px;color:#475569;font-size:13px;line-height:1.6;">
                        Cancellation policy: <strong>%s</strong>. Free before 48 hours; first-night penalty after the deadline.
                      </div>
                      <p style="margin:24px 0 0;color:#475569;line-height:1.6;">Thank you for choosing <strong>%s</strong>. We look forward to welcoming you.</p>
                """
                .formatted(
                        esc(displayName(guest)),
                        card("Stay period", reservation.getCheckInDate() + " to " + reservation.getCheckOutDate()),
                        card("Nights", nights + " night" + (nights == 1 ? "" : "s")),
                        card("Room", roomNumber + " - " + roomType),
                        card("Guests", guests),
                        moneyRow("Nightly rate", reservation.getNightlyRate() + " " + currency),
                        moneyRow("Room subtotal", reservation.getTotalAmount() + " " + currency),
                        moneyRow("Deposit paid", depositLine),
                        infoRow("Name", displayName(guest)),
                        infoRow("National ID", defaultText(guest.getNationalId(), "-")),
                        infoRow("Email", defaultText(guest.getEmail(), "-")),
                        infoRow("Phone", defaultText(guest.getPhone(), "-")),
                        infoRow("Nationality", defaultText(guest.getNationality(), "-")),
                        requests,
                        esc(defaultText(reservation.getCancellationPolicy(), "STANDARD")),
                        esc(hotel.getName()));
        return brandedEmail(hotel, "Reservation confirmed", hotel.getName(), content, hero);
    }

    private static String brandedEmail(Hotel hotel, String eyebrow, String title, String contentHtml, String heroHtml) {
        String logo = hotel.getLogoUrl() != null && !hotel.getLogoUrl().isBlank()
                ? "<img src=\"" + esc(hotel.getLogoUrl()) + "\" alt=\"" + esc(hotel.getName()) + " logo\" style=\"height:54px;max-width:160px;object-fit:contain;border-radius:14px;display:block;\">"
                : "<div style=\"height:54px;width:54px;border-radius:18px;background:linear-gradient(135deg,#0f766e,#1d4ed8);color:#fff;font:800 22px Arial,sans-serif;display:flex;align-items:center;justify-content:center;\">"
                        + initials(hotel.getName()) + "</div>";
        return """
                <!doctype html>
                <html>
                <body style="margin:0;background:#f1f5f9;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
                  <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.16);border:1px solid #e2e8f0;">
                    <div style="background:linear-gradient(135deg,#0f766e 0%%,#0f172a 58%%,#1d4ed8 100%%);padding:28px;color:#fff;">
                      <div style="display:flex;gap:16px;align-items:center;">
                        %s
                        <div>
                          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.16em;opacity:.75;font-weight:800;">%s</div>
                          <div style="font-size:25px;font-weight:900;margin-top:4px;">%s</div>
                          <div style="font-size:13px;opacity:.82;margin-top:4px;">%s</div>
                        </div>
                      </div>
                      %s
                    </div>
                    <div style="padding:28px;">
                      %s
                      <div style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:16px;color:#64748b;font-size:12px;line-height:1.5;">
                        Sent by <strong>%s</strong>. This message relates to your hotel guest relationship.
                      </div>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(
                logo,
                esc(eyebrow),
                esc(title),
                esc(defaultText(hotel.getAddress(), "Hotel guest services")),
                heroHtml != null ? heroHtml : "",
                contentHtml,
                esc(hotel.getName()));
    }

    public static String brandedMarketingEmail(Guest guest, String eyebrow, String title, String messageHtml) {
        return brandedEmail(
                guest.getHotel(),
                eyebrow,
                title,
                """
                <p style="font-size:17px;line-height:1.65;margin:0 0 18px;">Dear <strong>%s</strong>,</p>
                <div style="font-size:15px;line-height:1.7;color:#334155;">%s</div>
                """.formatted(esc(displayName(guest)), messageHtml),
                null);
    }

    public static String brandedReservationEmail(Reservation reservation, String eyebrow, String title, String messageHtml) {
        return brandedEmail(
                reservation.getHotel(),
                eyebrow,
                title,
                """
                <p style="font-size:17px;line-height:1.65;margin:0 0 18px;">Dear <strong>%s</strong>,</p>
                <div style="font-size:15px;line-height:1.7;color:#334155;">%s</div>
                <div style="margin-top:18px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:18px;padding:14px;">
                  %s
                  %s
                  %s
                </div>
                """.formatted(
                        esc(displayName(reservation.getGuest())),
                        messageHtml,
                        infoRow("Booking reference", reservation.getBookingReference()),
                        infoRow("Stay", reservation.getCheckInDate() + " to " + reservation.getCheckOutDate()),
                        infoRow("Hotel", reservation.getHotel().getName())),
                null);
    }

    private static String card(String label, String value) {
        return "<div style=\"border:1px solid #e2e8f0;background:#f8fafc;border-radius:18px;padding:14px;\">"
                + "<div style=\"font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:900;\">"
                + esc(label) + "</div><div style=\"font-size:15px;font-weight:800;margin-top:6px;color:#0f172a;\">"
                + esc(value) + "</div></div>";
    }

    private static String moneyRow(String label, String value) {
        return "<div style=\"display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #dbeafe;padding-bottom:8px;\">"
                + "<span style=\"color:#475569;\">" + esc(label) + "</span><strong style=\"color:#0f172a;\">"
                + esc(value) + "</strong></div>";
    }

    private static String infoRow(String label, String value) {
        return "<div style=\"display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;\">"
                + "<span style=\"color:#64748b;\">" + esc(label) + "</span><strong style=\"text-align:right;color:#0f172a;\">"
                + esc(value) + "</strong></div>";
    }

    private static String initials(String name) {
        if (name == null || name.isBlank()) {
            return "H";
        }
        String[] parts = name.trim().split("\\s+");
        String out = parts[0].substring(0, 1);
        if (parts.length > 1) {
            out += parts[1].substring(0, 1);
        }
        return esc(out.toUpperCase());
    }

    private static String defaultText(String value, String fallback) {
        return value != null && !value.isBlank() ? value.trim() : fallback;
    }

    private static String esc(Object value) {
        if (value == null) {
            return "";
        }
        return value.toString()
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    public static String escapeHtml(Object value) {
        return esc(value);
    }

    private static boolean isHtmlEmail(String body) {
        if (body == null) {
            return false;
        }
        String b = body.stripLeading().toLowerCase();
        return b.startsWith("<!doctype html") || b.startsWith("<html") || b.contains("<body");
    }

    private static String displayName(Guest guest) {
        if (guest.getFullName() != null && !guest.getFullName().isBlank()) {
            return guest.getFullName().trim();
        }
        return ((guest.getFirstName() != null ? guest.getFirstName() : "") + " "
                + (guest.getLastName() != null ? guest.getLastName() : "")).trim();
    }

    @Transactional
    public void queueBookingConfirmationSms(Reservation reservation) {
        try {
            Guest g = reservation.getGuest();
            Hotel h = reservation.getHotel();
            if (g.getPhone() == null || g.getPhone().isBlank()) {
                return;
            }
            Notification n = new Notification();
            n.setHotel(h);
            n.setType("BOOKING_CONFIRMATION");
            n.setChannel("SMS");
            n.setRecipientType("GUEST");
            n.setRecipientId(g.getId());
            n.setSubject("Booking confirmed");
            n.setBody("Booking " + reservation.getBookingReference() + " confirmed. Check-in: "
                    + reservation.getCheckInDate());
            n.setStatus("PENDING");
            n.setScheduledFor(Instant.now());
            n.setReferenceType("RESERVATION");
            n.setReferenceId(reservation.getId());
            notificationRepository.save(n);
        } catch (RuntimeException e) {
            log.warn("Could not queue booking confirmation SMS: {}", e.getMessage());
        }
    }

    @Transactional
    public void schedulePostStayEmail(Reservation reservation) {
        Guest g = reservation.getGuest();
        Hotel h = reservation.getHotel();
        if (g.getEmail() == null || g.getEmail().isBlank()) {
            return;
        }
        Notification n = new Notification();
        n.setHotel(h);
        n.setType("POST_STAY_THANK_YOU");
        n.setChannel("EMAIL");
        n.setRecipientType("GUEST");
        n.setRecipientId(g.getId());
        n.setRecipientAddress(g.getEmail().trim());
        n.setSubject("Thank you for staying with " + h.getName());
        n.setBody(brandedReservationEmail(
                reservation,
                "Thank you",
                "Thank you for staying with " + h.getName(),
                "<p style=\"margin:0 0 12px;\">Thank you for staying with <strong>" + esc(h.getName()) + "</strong>.</p>"
                        + "<p style=\"margin:0;\">We hope you enjoyed your stay. We would be happy to welcome you again.</p>"));
        n.setStatus("PENDING");
        n.setScheduledFor(Instant.now().plusSeconds(7200));
        n.setReferenceType("RESERVATION");
        n.setReferenceId(reservation.getId());
        notificationRepository.save(n);
    }

    @Transactional
    public void sendNotification(Hotel hotel, UUID guestId, String type, String message) {
        Notification n = new Notification();
        n.setHotel(hotel);
        n.setType(type);
        n.setChannel("EMAIL");
        n.setRecipientType("GUEST");
        n.setRecipientId(guestId);
        n.setSubject("Message from " + hotel.getName());
        n.setBody(brandedEmail(
                hotel,
                "Hotel message",
                "Message from " + hotel.getName(),
                "<div style=\"font-size:15px;line-height:1.7;color:#334155;\">" + esc(message) + "</div>",
                null));
        n.setStatus("PENDING");
        n.setScheduledFor(Instant.now());
        notificationRepository.save(n);
    }

    @Transactional
    public void queueMarketingEmail(Guest guest, String type, String subject, String body, Instant scheduledFor) {
        if (guest == null || guest.getHotel() == null || guest.getEmail() == null || guest.getEmail().isBlank()) {
            return;
        }
        Hotel hotel = guest.getHotel();
        Notification n = new Notification();
        n.setHotel(hotel);
        n.setType(type);
        n.setChannel("EMAIL");
        n.setRecipientType("GUEST");
        n.setRecipientId(guest.getId());
        n.setRecipientAddress(guest.getEmail().trim());
        n.setSubject(subject);
        n.setBody(isHtmlEmail(body)
                ? body
                : brandedMarketingEmail(guest, "Guest update", subject, "<p style=\"margin:0;\">" + esc(body) + "</p>"));
        n.setStatus("PENDING");
        n.setScheduledFor(scheduledFor != null ? scheduledFor : Instant.now());
        n.setReferenceType("GUEST");
        n.setReferenceId(guest.getId());
        notificationRepository.save(n);
    }

    @Transactional
    public void queueReservationEmail(Reservation reservation, String type, String subject, String body, Instant scheduledFor) {
        Guest guest = reservation.getGuest();
        if (guest == null || guest.getEmail() == null || guest.getEmail().isBlank()) {
            return;
        }
        Notification n = new Notification();
        n.setHotel(reservation.getHotel());
        n.setType(type);
        n.setChannel("EMAIL");
        n.setRecipientType("GUEST");
        n.setRecipientId(guest.getId());
        n.setRecipientAddress(guest.getEmail().trim());
        n.setSubject(subject);
        n.setBody(isHtmlEmail(body)
                ? body
                : brandedReservationEmail(reservation, "Reservation update", subject, "<p style=\"margin:0;\">" + esc(body) + "</p>"));
        n.setStatus("PENDING");
        n.setScheduledFor(scheduledFor != null ? scheduledFor : Instant.now());
        n.setReferenceType("RESERVATION");
        n.setReferenceId(reservation.getId());
        notificationRepository.save(n);
    }
}
