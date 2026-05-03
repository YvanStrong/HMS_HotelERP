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
 * Ensures rooms.photo_url exists for persisted room images.
 * Uses idempotent PostgreSQL DDL on app datasource at startup.
 */
@Slf4j
@Component
@Order
public class RoomsPhotoColumnSchemaPatch implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public RoomsPhotoColumnSchemaPatch(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        DataSource dataSource = jdbcTemplate.getDataSource();
        if (dataSource == null) {
            return;
        }
        try (Connection c = dataSource.getConnection()) {
            String product = c.getMetaData().getDatabaseProductName();
            if (product == null || !product.toLowerCase(Locale.ROOT).contains("postgres")) {
                return;
            }
        } catch (SQLException e) {
            log.debug("Skipping rooms photo column patch (could not read DB metadata): {}", e.getMessage());
            return;
        }

        jdbcTemplate.execute("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS photo_url TEXT");
    }
}
