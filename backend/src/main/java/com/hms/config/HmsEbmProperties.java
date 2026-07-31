package com.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * RRA EBM / VSDC / OSDC client settings. Endpoint paths follow common EBM 2.1 CIS naming;
 * override via env when official RRA docs differ.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "hms.ebm")
public class HmsEbmProperties {

    /** Master switch — when false, sales are not enqueued and workers no-op. */
    private boolean enabled = false;

    /** AES secret used to encrypt device signing keys at rest (min 16 chars recommended). */
    private String keyEncryptionSecret = "";

    /** Default product type digit for itemCd when not set on the item (2 = finished goods). */
    private String defaultItemTyCd = "2";

    /** Default packaging unit code (RRA code list). */
    private String defaultPkgUnitCd = "NT";

    /** Default quantity unit code (RRA code list). */
    private String defaultQtyUnitCd = "BA";

    /** Default item classification code until code-list sync fills real values. */
    private String defaultItemClsCd = "5020230601";

    /** Country code prefix for itemCd. */
    private String countryCode = "RW";

    /** Hours before 24h cutoff to warn operators. */
    private int offlineWarnHours = 18;

    /** Hours before 24h cutoff for hard alert. */
    private int offlineAlertHours = 22;

    private long outboxPollMs = 15_000L;

    private int outboxBatchSize = 20;

    private long syncPollMs = 300_000L;

    /** Relative paths appended to device vsdc_endpoint_url (or OSDC base). */
    private Paths paths = new Paths();

    @Getter
    @Setter
    public static class Paths {
        private String init = "/initializer/selectInitInfo";
        /** OSDC sales save; VSDC WAR may use /trnsSales/saveSales — override via config. */
        private String salesTransaction = "/trnsSales/saveSales";
        private String salesInvoice = "/trnsSales/saveSales";
        private String stockIo = "/stock/saveStockItems";
        private String stockMaster = "/stockMaster/saveStockMaster";
        private String codeList = "/code/selectCodes";
        private String itemClass = "/itemClass/selectItemsClass";
        /** Official OSDC documentation: /insertTrnsPurchase */
        private String purchase = "/insertTrnsPurchase";
        /** Official OSDC documentation: /saveItem */
        private String itemSave = "/saveItem";
    }
}
