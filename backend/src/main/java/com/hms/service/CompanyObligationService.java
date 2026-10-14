package com.hms.service;

import com.hms.api.dto.AccountingDtos;
import com.hms.entity.CompanyObligation;
import com.hms.entity.Hotel;
import com.hms.repository.CompanyObligationRepository;
import com.hms.repository.HotelRepository;
import com.hms.security.TenantAccessService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompanyObligationService {

    private final CompanyObligationRepository repository;
    private final HotelRepository hotelRepository;
    private final TenantAccessService tenantAccessService;

    public CompanyObligationService(
            CompanyObligationRepository repository,
            HotelRepository hotelRepository,
            TenantAccessService tenantAccessService) {
        this.repository = repository;
        this.hotelRepository = hotelRepository;
        this.tenantAccessService = tenantAccessService;
    }

    @Transactional(readOnly = true)
    public AccountingDtos.CompanyObligationList list(UUID hotelId, String hotelHeader) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        List<CompanyObligation> rows = repository.findByHotel_IdOrderByEntryDateDescCreatedAtDesc(hotelId);
        BigDecimal openCredit = sum(rows, "CREDIT");
        BigDecimal openDebt = sum(rows, "DEBT");
        return new AccountingDtos.CompanyObligationList(
                scale(openCredit),
                scale(openDebt),
                scale(openCredit.subtract(openDebt)),
                rows.stream().map(this::toRow).toList());
    }

    @Transactional
    public AccountingDtos.CompanyObligationRow create(
            UUID hotelId, String hotelHeader, AccountingDtos.CreateCompanyObligationRequest req) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        String kind = normalizeKind(req.kind());
        if (req.amount() == null || req.amount().signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Amount must be greater than zero");
        }
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        CompanyObligation row = new CompanyObligation();
        row.setHotel(hotel);
        row.setKind(kind);
        row.setPartyName(req.partyName().trim());
        row.setDescription(req.description().trim());
        row.setAmount(req.amount().setScale(2, RoundingMode.HALF_UP));
        row.setEntryDate(req.entryDate() != null ? req.entryDate() : LocalDate.now());
        row.setDueDate(req.dueDate());
        row.setStatus("OPEN");
        row.setReferenceNo(blankToNull(req.referenceNo()));
        row.setRecordedBy(tenantAccessService.currentUser().getUsername());
        row.setCreatedAt(Instant.now());
        return toRow(repository.save(row));
    }

    @Transactional
    public void recordPosCredit(
            UUID hotelId, String partyName, String saleNumber, BigDecimal amount, LocalDate entryDate, String recordedBy) {
        if (saleNumber == null || saleNumber.isBlank() || amount == null || amount.signum() <= 0) return;
        boolean already = repository.findByHotel_IdAndReferenceNoAndKind(hotelId, saleNumber, "CREDIT").stream()
                .anyMatch(row -> row.getAmount() != null);
        if (already) return;
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        CompanyObligation row = new CompanyObligation();
        row.setHotel(hotel);
        row.setKind("CREDIT");
        row.setPartyName(partyName == null || partyName.isBlank() ? "Walk-in" : partyName.trim());
        row.setDescription("POS invoice " + saleNumber + " given on credit");
        row.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        row.setEntryDate(entryDate != null ? entryDate : LocalDate.now());
        row.setStatus("OPEN");
        row.setReferenceNo(saleNumber);
        row.setRecordedBy(recordedBy);
        row.setCreatedAt(Instant.now());
        repository.save(row);
    }

    @Transactional
    public void settleByReference(UUID hotelId, String referenceNo) {
        if (referenceNo == null || referenceNo.isBlank()) return;
        for (CompanyObligation row : repository.findByHotel_IdAndReferenceNoAndKind(hotelId, referenceNo, "CREDIT")) {
            if (!"OPEN".equals(row.getStatus())) continue;
            row.setStatus("SETTLED");
            row.setSettledAt(Instant.now());
            repository.save(row);
        }
    }

    @Transactional
    public AccountingDtos.CompanyObligationRow settle(UUID hotelId, String hotelHeader, UUID id) {
        tenantAccessService.assertHotelAccess(hotelId, hotelHeader);
        CompanyObligation row = repository
                .findByIdAndHotel_Id(id, hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Record not found"));
        row.setStatus("SETTLED");
        row.setSettledAt(Instant.now());
        return toRow(repository.save(row));
    }

    private static BigDecimal sum(List<CompanyObligation> rows, String kind) {
        return rows.stream()
                .filter(r -> "OPEN".equals(r.getStatus()) && kind.equals(r.getKind()))
                .map(CompanyObligation::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal scale(BigDecimal n) {
        return n.setScale(2, RoundingMode.HALF_UP);
    }

    private static String normalizeKind(String raw) {
        String kind = raw == null ? "" : raw.trim().toUpperCase();
        if (!"CREDIT".equals(kind) && !"DEBT".equals(kind)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Type must be CREDIT or DEBT");
        }
        return kind;
    }

    private static String blankToNull(String v) {
        if (v == null || v.isBlank()) return null;
        return v.trim();
    }

    private AccountingDtos.CompanyObligationRow toRow(CompanyObligation r) {
        return new AccountingDtos.CompanyObligationRow(
                r.getId(),
                r.getKind(),
                r.getPartyName(),
                r.getDescription(),
                r.getAmount(),
                r.getEntryDate(),
                r.getDueDate(),
                r.getStatus(),
                r.getReferenceNo(),
                r.getRecordedBy(),
                r.getSettledAt(),
                r.getCreatedAt());
    }
}
