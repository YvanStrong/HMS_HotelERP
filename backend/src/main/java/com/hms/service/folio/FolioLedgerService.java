package com.hms.service.folio;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.FolioStatus;
import com.hms.domain.ReservationStatus;
import com.hms.entity.GuestFolio;
import com.hms.entity.FolioTransaction;
import com.hms.entity.Hotel;
import com.hms.entity.Payment;
import com.hms.entity.Reservation;
import com.hms.entity.RoomCharge;
import com.hms.repository.FolioTransactionRepository;
import com.hms.repository.GuestFolioRepository;
import com.hms.repository.PaymentRepository;
import com.hms.repository.ReservationRepository;
import com.hms.repository.RoomChargeRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FolioLedgerService {

    private final GuestFolioRepository guestFolioRepository;
    private final FolioTransactionRepository folioTransactionRepository;
    private final RoomChargeRepository roomChargeRepository;
    private final PaymentRepository paymentRepository;
    private final ReservationRepository reservationRepository;

    public FolioLedgerService(
            GuestFolioRepository guestFolioRepository,
            FolioTransactionRepository folioTransactionRepository,
            RoomChargeRepository roomChargeRepository,
            PaymentRepository paymentRepository,
            ReservationRepository reservationRepository) {
        this.guestFolioRepository = guestFolioRepository;
        this.folioTransactionRepository = folioTransactionRepository;
        this.roomChargeRepository = roomChargeRepository;
        this.paymentRepository = paymentRepository;
        this.reservationRepository = reservationRepository;
    }

    public record FolioComputation(
            BigDecimal roomChargesTotal,
            BigDecimal otherChargesTotal,
            BigDecimal subtotalPreTax,
            BigDecimal taxTotal,
            BigDecimal discountTotal,
            BigDecimal grandTotal,
            BigDecimal depositCredit,
            BigDecimal paymentsTotal,
            BigDecimal balanceDue) {}

    public FolioComputation compute(Reservation r, List<RoomCharge> charges, List<Payment> payments) {
        Hotel hotel = r.getHotel();
        BigDecimal roomTotal = nz(r.getTotalAmount());
        BigDecimal other =
                charges.stream().map(RoomCharge::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal gross = roomTotal.add(other).setScale(2, RoundingMode.HALF_UP);
        BigDecimal tax = FolioTax.taxOnSubtotal(gross, hotel);
        BigDecimal discount = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal grand = gross.add(tax).subtract(discount).setScale(2, RoundingMode.HALF_UP);
        BigDecimal depositCredit =
                r.isDepositPaid() && r.getDepositAmount() != null
                        ? r.getDepositAmount().setScale(2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal paymentRows =
                payments.stream()
                        .filter(p -> "COMPLETED".equalsIgnoreCase(p.getStatus()))
                        .map(Payment::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paymentsTotal = paymentRows.add(depositCredit).setScale(2, RoundingMode.HALF_UP);
        BigDecimal balanceDue = grand.subtract(paymentsTotal).setScale(2, RoundingMode.HALF_UP);
        return new FolioComputation(roomTotal, other, gross, tax, discount, grand, depositCredit, paymentsTotal, balanceDue);
    }

    public ApiDtos.FolioSummary toSummary(Reservation r, List<RoomCharge> charges, List<Payment> payments) {
        FolioComputation c = compute(r, charges, payments);
        String currency = r.getHotel() != null ? r.getHotel().getCurrency() : "USD";
        return new ApiDtos.FolioSummary(
                r.getId(),
                c.roomChargesTotal(),
                c.otherChargesTotal(),
                c.subtotalPreTax(),
                c.taxTotal(),
                c.discountTotal(),
                c.grandTotal(),
                c.depositCredit(),
                c.paymentsTotal(),
                c.balanceDue(),
                currency);
    }

    @Transactional(readOnly = true)
    public BigDecimal computeBalanceDue(UUID hotelId, UUID guestId) {
        BigDecimal sum = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        for (Reservation r : reservationRepository.findByHotel_IdAndGuest_IdOrderByCheckInDateDesc(hotelId, guestId)) {
            if (r.getStatus() != ReservationStatus.CHECKED_IN || r.getFolioStatus() != FolioStatus.OPEN) {
                continue;
            }
            List<RoomCharge> ch = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(r.getId());
            List<Payment> pay = paymentRepository.findByReservation_IdOrderByProcessedAtDesc(r.getId());
            sum = sum.add(compute(r, ch, pay).balanceDue());
        }
        return sum;
    }

    @Transactional
    public GuestFolio ensureGuestFolio(Reservation r) {
        return guestFolioRepository
                .findByReservation_Id(r.getId())
                .orElseGet(
                        () -> {
                            GuestFolio gf = new GuestFolio();
                            gf.setReservation(r);
                            gf.setGuest(r.getGuest());
                            gf.setCurrency(r.getHotel() != null ? r.getHotel().getCurrency() : "USD");
                            gf.setStatus(r.getFolioStatus() != null ? r.getFolioStatus().name() : "CLOSED");
                            return guestFolioRepository.save(gf);
                        });
    }

    @Transactional
    public void refreshGuestFolioSnapshot(Reservation r) {
        UUID hotelId =
                r.getHotel() != null
                        ? r.getHotel().getId()
                        : reservationRepository
                                .findHotelIdById(r.getId())
                                .orElseThrow(() -> new IllegalStateException("Reservation hotel not found: " + r.getId()));
        Reservation loaded =
                reservationRepository.findDetailedByIdAndHotel_Id(r.getId(), hotelId).orElse(r);
        List<RoomCharge> charges = roomChargeRepository.findByReservation_IdOrderByChargedAtDesc(loaded.getId());
        List<Payment> payments = paymentRepository.findByReservation_IdOrderByProcessedAtDesc(loaded.getId());
        FolioComputation c = compute(loaded, charges, payments);
        GuestFolio gf = ensureGuestFolio(loaded);
        gf.setGuest(loaded.getGuest());
        gf.setCurrency(loaded.getHotel() != null ? loaded.getHotel().getCurrency() : "USD");
        gf.setSubtotal(c.subtotalPreTax());
        gf.setTax(c.taxTotal());
        gf.setDiscount(c.discountTotal());
        gf.setDeposit(c.depositCredit());
        gf.setTotal(c.grandTotal());
        gf.setPaid(c.paymentsTotal());
        gf.setBalance(c.balanceDue());
        gf.setStatus(loaded.getFolioStatus() != null ? loaded.getFolioStatus().name() : "CLOSED");
        guestFolioRepository.save(gf);
    }

    @Transactional
    public void onRoomChargePosted(RoomCharge charge) {
        Reservation r = charge.getReservation();
        GuestFolio gf = ensureGuestFolio(r);
        FolioTransaction t = folioTransactionRepository.findByRoomCharge_Id(charge.getId()).orElseGet(() -> {
            FolioTransaction row = new FolioTransaction();
            row.setGuestFolio(gf);
            row.setTxnType("CHARGE");
            row.setDebitCredit("DEBIT");
            row.setReference(charge.getId().toString());
            row.setCreatedAt(charge.getChargedAt() != null ? charge.getChargedAt() : charge.getCreatedAt());
            row.setRoomCharge(charge);
            return row;
        });
        t.setGuestFolio(gf);
        t.setCategory(charge.getChargeType() != null ? charge.getChargeType().name() : "CHARGE");
        t.setDescription(charge.getDescription());
        t.setAmount(charge.getAmount().setScale(2, RoundingMode.HALF_UP));
        folioTransactionRepository.save(t);
        refreshGuestFolioSnapshot(r);
    }

    @Transactional
    public void onPaymentPosted(Payment p) {
        Reservation r = p.getReservation();
        GuestFolio gf = ensureGuestFolio(r);
        if ("COMPLETED".equalsIgnoreCase(p.getStatus()) && !folioTransactionRepository.existsByPayment_Id(p.getId())) {
            FolioTransaction t = new FolioTransaction();
            t.setGuestFolio(gf);
            t.setTxnType("PAYMENT");
            t.setCategory(p.getPaymentType());
            String desc =
                    p.getNotes() != null && !p.getNotes().isBlank()
                            ? p.getNotes()
                            : p.getPaymentType() + " " + p.getMethod();
            t.setDescription(desc);
            t.setAmount(p.getAmount().setScale(2, RoundingMode.HALF_UP));
            t.setDebitCredit("CREDIT");
            t.setReference(p.getReference());
            t.setCreatedAt(p.getProcessedAt());
            t.setPayment(p);
            folioTransactionRepository.save(t);
        }
        refreshGuestFolioSnapshot(r);
    }

    @Transactional
    public void onPaymentVoided(Payment p) {
        Reservation r = p.getReservation();
        GuestFolio gf = ensureGuestFolio(r);
        FolioTransaction t = new FolioTransaction();
        t.setGuestFolio(gf);
        t.setTxnType("REFUND");
        t.setCategory("PAYMENT_VOID");
        t.setDescription("Voided payment " + p.getId());
        t.setAmount(p.getAmount().setScale(2, RoundingMode.HALF_UP));
        t.setDebitCredit("DEBIT");
        t.setReference(p.getId().toString());
        t.setCreatedAt(Instant.now());
        folioTransactionRepository.save(t);
        refreshGuestFolioSnapshot(r);
    }

    @Transactional(readOnly = true)
    public List<ApiDtos.FolioLedgerLine> ledgerForReservation(UUID reservationId) {
        return guestFolioRepository
                .findByReservation_Id(reservationId)
                .map(
                        gf -> folioTransactionRepository.findByGuestFolio_IdOrderByCreatedAtDesc(gf.getId()).stream()
                                .map(
                                        t -> new ApiDtos.FolioLedgerLine(
                                                t.getId(),
                                                t.getTxnType(),
                                                t.getCategory(),
                                                t.getDescription(),
                                                t.getAmount(),
                                                t.getDebitCredit(),
                                                t.getReference(),
                                                t.getCreatedAt()))
                                .toList())
                .orElse(List.of());
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : v.setScale(2, RoundingMode.HALF_UP);
    }
}
