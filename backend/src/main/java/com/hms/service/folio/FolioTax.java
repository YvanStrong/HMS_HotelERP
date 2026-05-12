package com.hms.service.folio;

import com.hms.entity.Hotel;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Single source of truth for hotel VAT/sales tax rate applied to folio-style totals. */
public final class FolioTax {

    public static final BigDecimal DEFAULT_TAX_RATE = new BigDecimal("0.18");

    private FolioTax() {}

    /**
     * Returns a decimal rate (e.g. 0.18 for 18%). {@code hotel.tax_rate}: if {@code > 1}, treated as whole
     * percent (18 → 0.18); otherwise used as-is. Null/zero/negative falls back to {@link #DEFAULT_TAX_RATE}.
     */
    public static BigDecimal effectiveRate(Hotel hotel) {
        if (hotel == null) {
            return DEFAULT_TAX_RATE;
        }
        BigDecimal tr = hotel.getTaxRate();
        if (tr == null || tr.compareTo(BigDecimal.ZERO) <= 0) {
            return DEFAULT_TAX_RATE;
        }
        if (tr.compareTo(BigDecimal.ONE) > 0) {
            return tr.movePointLeft(2).max(new BigDecimal("0.001")).min(new BigDecimal("0.99"));
        }
        return tr.min(new BigDecimal("0.99"));
    }

    public static BigDecimal taxOnSubtotal(BigDecimal subtotalPreTax, Hotel hotel) {
        if (subtotalPreTax == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return subtotalPreTax.multiply(effectiveRate(hotel)).setScale(2, RoundingMode.HALF_UP);
    }
}
