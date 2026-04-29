package com.hms.config;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures {@code hotels} string columns used for marketing copy and inline images are {@code TEXT}
 * on PostgreSQL. Hibernate {@code ddl-auto=update} does not always widen {@code varchar(2048)} to
 * {@code TEXT}, and manual migrations are easy to run against the wrong database — this aligns the
 * <em>application datasource</em> on startup (idempotent on PostgreSQL).
 */
@Slf4j
@Component
@Order
public class HotelsTextColumnsSchemaPatch implements ApplicationRunner {

    private static final List<String> COLUMNS = List.of("image_url", "logo_url", "description", "address");

    private final JdbcTemplate jdbcTemplate;

    public HotelsTextColumnsSchemaPatch(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try (Connection c = jdbcTemplate.getDataSource().getConnection()) {
            String product = c.getMetaData().getDatabaseProductName();
            if (product == null || !product.toLowerCase(Locale.ROOT).contains("postgres")) {
                return;
            }
        } catch (SQLException e) {
            log.debug("Skipping hotels TEXT patch (could not read DB metadata): {}", e.getMessage());
            return;
        }

        for (String col : COLUMNS) {
            try {
                jdbcTemplate.execute("ALTER TABLE hotels ALTER COLUMN " + col + " TYPE TEXT");
            } catch (DataAccessException e) {
                log.debug("Hotels column {} not altered to TEXT (may be missing or already OK): {}", col, e.getMessage());
            }
        }
    }
}
