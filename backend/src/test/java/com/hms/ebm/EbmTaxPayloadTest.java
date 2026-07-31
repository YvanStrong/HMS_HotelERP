package com.hms.ebm;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EbmTaxPayloadTest {

    @Test
    void splitsInclusiveVatForTaxB() {
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("qty", 1);
        line.put("prc", new BigDecimal("1180.00"));
        line.put("splyAmt", new BigDecimal("1180.00"));
        line.put("taxTyCd", "B");
        EbmTaxPayload.enrichLine(line, 1, "5020230601");
        assertEquals(new BigDecimal("1000.00"), line.get("taxblAmt"));
        assertEquals(new BigDecimal("180.00"), line.get("taxAmt"));
        assertEquals(new BigDecimal("1180.00"), line.get("totAmt"));
    }

    @Test
    void headerTotalsAggregateAAndB() {
        List<Map<String, Object>> lines = new ArrayList<>();
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("qty", 1);
        a.put("splyAmt", new BigDecimal("500.00"));
        a.put("taxTyCd", "A");
        EbmTaxPayload.enrichLine(a, 1, "5020230601");
        lines.add(a);
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("qty", 1);
        b.put("splyAmt", new BigDecimal("1180.00"));
        b.put("taxTyCd", "B");
        EbmTaxPayload.enrichLine(b, 2, "5020230601");
        lines.add(b);
        Map<String, Object> payload = new LinkedHashMap<>();
        EbmTaxPayload.applyHeaderTaxTotals(payload, lines);
        assertEquals(2, payload.get("totItemCnt"));
        assertEquals(new BigDecimal("500.00"), payload.get("taxblAmtA"));
        assertEquals(new BigDecimal("1000.00"), payload.get("taxblAmtB"));
        assertEquals(new BigDecimal("180.00"), payload.get("taxAmtB"));
        assertEquals(new BigDecimal("1500.00"), payload.get("totTaxblAmt"));
    }
}
