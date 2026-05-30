package com.hms.service.folio;

import com.hms.entity.Hotel;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Single source of truth for hotel tourism tax applied to folio-style totals. */
public final class FolioTax {

    public static final BigDecimal DEFAULT_TAX_RATE = new BigDecimal("0.03");
    public static final String TAX_LABEL = "Tourism Tax (TT)";

    private FolioTax() {}

    /**
     * Returns a decimal rate (e.g. 0.03 for 3%). {@code hotel.tax_rate}: if {@code > 1}, treated as whole
     * percent (3 → 0.03); otherwise used as-is. Null/zero/negative falls back to {@link #DEFAULT_TAX_RATE}.
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
