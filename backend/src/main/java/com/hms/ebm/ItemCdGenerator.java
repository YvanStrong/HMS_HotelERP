package com.hms.ebm;

import com.hms.config.HmsEbmProperties;
import org.springframework.stereotype.Component;

/**
 * RRA itemCd: [CountryCode(2)][ProductType(1)][PackagingUnit(2)][QtyUnit(2)][7-digit sequence]
 * Example: RW2NTBA0000012
 */
@Component
public class ItemCdGenerator {

    private final HmsEbmProperties properties;

    public ItemCdGenerator(HmsEbmProperties properties) {
        this.properties = properties;
    }

    public String generate(String itemTyCd, String pkgUnitCd, String qtyUnitCd, long sequence) {
        String country = nullTo(properties.getCountryCode(), "RW").trim().toUpperCase();
        String ty = nullTo(itemTyCd, properties.getDefaultItemTyCd()).trim();
        String pkg = nullTo(pkgUnitCd, properties.getDefaultPkgUnitCd()).trim().toUpperCase();
        String qty = nullTo(qtyUnitCd, properties.getDefaultQtyUnitCd()).trim().toUpperCase();
        if (ty.length() != 1) {
            ty = ty.isEmpty() ? "2" : ty.substring(0, 1);
        }
        if (pkg.length() != 2) {
            pkg = (pkg + "XX").substring(0, 2);
        }
        if (qty.length() != 2) {
            qty = (qty + "XX").substring(0, 2);
        }
        if (sequence < 1 || sequence > 9_999_999L) {
            throw new IllegalArgumentException("itemCd sequence must be 1..9999999");
        }
        return country + ty + pkg + qty + String.format("%07d", sequence);
    }

    private static String nullTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
