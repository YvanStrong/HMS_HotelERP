package com.hms.config;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;
import javax.sql.DataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent PostgreSQL patch for depot inventory tables.
 * Fixes legacy BYTEA text columns and guarantees required columns/defaults exist.
 */
@Slf4j
@Component
@Order
public class InventoryDepotSchemaPatch implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public InventoryDepotSchemaPatch(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        DataSource ds = jdbcTemplate.getDataSource();
        if (ds == null) return;
        try (Connection c = ds.getConnection()) {
            String product = c.getMetaData().getDatabaseProductName();
            if (product == null || !product.toLowerCase(Locale.ROOT).contains("postgres")) {
                return;
            }
        } catch (SQLException e) {
            log.debug("Skipping depot schema patch (DB metadata unavailable): {}", e.getMessage());
            return;
        }

        // Ensure core tables exist even if ddl-auto did not complete previously.
        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS inventory_depots (" +
                        "id UUID PRIMARY KEY, " +
                        "hotel_id UUID NOT NULL, " +
                        "name VARCHAR(120) NOT NULL, " +
                        "code VARCHAR(64) NOT NULL, " +
                        "depot_type VARCHAR(32) NOT NULL, " +
                        "is_active BOOLEAN NOT NULL DEFAULT true, " +
                        "created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), " +
                        "updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now())");

        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS depot_products (" +
                        "id UUID PRIMARY KEY, " +
                        "hotel_id UUID NOT NULL, " +
                        "depot_id UUID NOT NULL, " +
                        "inventory_item_id UUID NULL, " +
                        "product_number INTEGER NOT NULL, " +
                        "product_name VARCHAR(255) NOT NULL, " +
                        "product_code VARCHAR(32) NOT NULL, " +
                        "batch_no VARCHAR(64) NOT NULL DEFAULT 'NA', " +
                        "expiry_date DATE NULL, " +
                        "cost_price NUMERIC(14,2) NOT NULL DEFAULT 0, " +
                        "selling_price NUMERIC(14,2) NOT NULL DEFAULT 0, " +
                        "stock_qty NUMERIC(14,3) NOT NULL DEFAULT 0, " +
                        "stock_type VARCHAR(16) NOT NULL DEFAULT 'STOCK', " +
                        "photo_url TEXT NULL, " +
                        "menu_name VARCHAR(80) NOT NULL DEFAULT 'GENERAL', " +
                        "is_active BOOLEAN NOT NULL DEFAULT true, " +
                        "created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), " +
                        "updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now())");

        // Convert possibly-broken bytea text columns.
        jdbcTemplate.execute("ALTER TABLE depot_products ALTER COLUMN product_name TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE depot_products ALTER COLUMN product_code TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE depot_products ALTER COLUMN batch_no TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE depot_products ALTER COLUMN menu_name TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE depot_products ALTER COLUMN photo_url TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE depot_products ADD COLUMN IF NOT EXISTS stock_type VARCHAR(16) NOT NULL DEFAULT 'STOCK'");
        jdbcTemplate.execute("UPDATE depot_products SET stock_type = 'STOCK' WHERE stock_type IS NULL");

        jdbcTemplate.execute("ALTER TABLE depot_products ALTER COLUMN batch_no SET DEFAULT 'NA'");
        jdbcTemplate.execute("ALTER TABLE depot_products ALTER COLUMN menu_name SET DEFAULT 'GENERAL'");
        jdbcTemplate.execute("ALTER TABLE depot_products ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true");
        jdbcTemplate.execute("ALTER TABLE depot_sale_lines ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT true");

        jdbcTemplate.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uk_inventory_depot_hotel_code_idx ON inventory_depots(hotel_id, code)");
        jdbcTemplate.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uk_depot_product_hotel_number_idx ON depot_products(hotel_id, product_number)");
        jdbcTemplate.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uk_depot_product_hotel_code_idx ON depot_products(hotel_id, product_code)");
    }
}
