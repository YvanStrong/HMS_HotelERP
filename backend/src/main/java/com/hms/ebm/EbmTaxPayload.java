package com.hms.ebm;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds RRA EBM 2.1 / OSDC-aligned tax breakdown fields from VAT-inclusive line totals
 * (HotelERP POS stores VAT-inclusive amounts; tax category B = 18%, A = 0%).
 *
 * Field names follow official OSDC TrnsSalesSaveWrReq examples
 * ({@code docs/ebm/official/OSDC_documentation_v1.0.1.pdf}).
 */
public final class EbmTaxPayload {

    public static final BigDecimal TAX_RATE_B = new BigDecimal("18");
    private static final DateTimeFormatter EBM_DT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter EBM_D =
            DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    private EbmTaxPayload() {}

    public static String formatDateTime(Instant instant) {
        return EBM_DT.format(instant != null ? instant : Instant.now());
    }

    public static String formatDate(Instant instant) {
        return EBM_D.format(instant != null ? instant : Instant.now());
    }

    /** Enrich a line map in-place with taxblAmt / taxAmt / totAmt / itemSeq / defaults. */
    public static void enrichLine(Map<String, Object> line, int itemSeq, String defaultItemClsCd) {
        line.putIfAbsent("itemSeq", itemSeq);
        line.putIfAbsent("itemClsCd", defaultItemClsCd);
        line.putIfAbsent("pkgUnitCd", "NT");
        line.putIfAbsent("qtyUnitCd", "U");
        line.putIfAbsent("pkg", 0);
        line.putIfAbsent("dcRt", 0);
        line.putIfAbsent("dcAmt", 0);

        BigDecimal qty = bd(line.get("qty"));
        BigDecimal sply = bd(line.get("splyAmt"));
        if (sply.signum() == 0 && line.get("prc") != null) {
            sply = bd(line.get("prc")).multiply(qty).setScale(2, RoundingMode.HALF_UP);
            line.put("splyAmt", sply);
        }
        String taxTy = String.valueOf(line.getOrDefault("taxTyCd", "B")).trim().toUpperCase();
        boolean nonTaxable = "A".equals(taxTy) || "N".equalsIgnoreCase(String.valueOf(line.get("taxblYn")));
        BigDecimal taxbl;
        BigDecimal tax;
        if (nonTaxable) {
            taxTy = "A";
            taxbl = sply.setScale(2, RoundingMode.HALF_UP);
            tax = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        } else {
            taxTy = "B";
            taxbl = splitInclusiveNet(sply);
            tax = sply.subtract(taxbl).setScale(2, RoundingMode.HALF_UP);
        }
        line.put("taxTyCd", taxTy);
        line.put("taxblAmt", taxbl);
        line.put("taxAmt", tax);
        line.put("totAmt", sply.setScale(2, RoundingMode.HALF_UP));
    }

    public static Map<String, Object> applyHeaderTaxTotals(Map<String, Object> payload, List<Map<String, Object>> lines) {
        BigDecimal taxblA = BigDecimal.ZERO;
        BigDecimal taxblB = BigDecimal.ZERO;
        BigDecimal taxblC = BigDecimal.ZERO;
        BigDecimal taxblD = BigDecimal.ZERO;
        BigDecimal taxA = BigDecimal.ZERO;
        BigDecimal taxB = BigDecimal.ZERO;
        BigDecimal taxC = BigDecimal.ZERO;
        BigDecimal taxD = BigDecimal.ZERO;
        BigDecimal totAmt = BigDecimal.ZERO;

        for (Map<String, Object> line : lines) {
            String ty = String.valueOf(line.getOrDefault("taxTyCd", "B"));
            BigDecimal taxbl = bd(line.get("taxblAmt"));
            BigDecimal tax = bd(line.get("taxAmt"));
            BigDecimal lineTot = bd(line.get("totAmt"));
            totAmt = totAmt.add(lineTot);
            switch (ty) {
                case "A" -> {
                    taxblA = taxblA.add(taxbl);
                    taxA = taxA.add(tax);
                }
                case "C" -> {
                    taxblC = taxblC.add(taxbl);
                    taxC = taxC.add(tax);
                }
                case "D" -> {
                    taxblD = taxblD.add(taxbl);
                    taxD = taxD.add(tax);
                }
                default -> {
                    taxblB = taxblB.add(taxbl);
                    taxB = taxB.add(tax);
                }
            }
        }

        BigDecimal totTaxbl = taxblA.add(taxblB).add(taxblC).add(taxblD);
        BigDecimal totTax = taxA.add(taxB).add(taxC).add(taxD);

        payload.put("totItemCnt", lines.size());
        payload.put("taxblAmtA", scale2(taxblA));
        payload.put("taxblAmtB", scale2(taxblB));
        payload.put("taxblAmtC", scale2(taxblC));
        payload.put("taxblAmtD", scale2(taxblD));
        payload.put("taxRtA", 0);
        payload.put("taxRtB", TAX_RATE_B);
        payload.put("taxRtC", 0);
        payload.put("taxRtD", 0);
        payload.put("taxAmtA", scale2(taxA));
        payload.put("taxAmtB", scale2(taxB));
        payload.put("taxAmtC", scale2(taxC));
        payload.put("taxAmtD", scale2(taxD));
        payload.put("totTaxblAmt", scale2(totTaxbl));
        payload.put("totTaxAmt", scale2(totTax));
        if (!payload.containsKey("totAmt") || payload.get("totAmt") == null) {
            payload.put("totAmt", scale2(totAmt));
        }
        return payload;
    }

    public static BigDecimal splitInclusiveNet(BigDecimal grossInclusive) {
        BigDecimal g = scale2(grossInclusive);
        if (g.signum() == 0) {
            return g;
        }
        return g.divide(BigDecimal.ONE.add(TAX_RATE_B.movePointLeft(2)), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal bd(Object v) {
        if (v == null) {
            return BigDecimal.ZERO;
        }
        if (v instanceof BigDecimal b) {
            return b;
        }
        try {
            return new BigDecimal(String.valueOf(v));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    private static BigDecimal scale2(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    public static Map<String, Object> emptyPurchaseShell() {
        return new LinkedHashMap<>();
    }
}
