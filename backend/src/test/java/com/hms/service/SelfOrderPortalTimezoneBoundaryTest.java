package com.hms.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.Test;

/** Documents the “hotel local day” boundary used by portal + health snapshots (DST-safe via java.time). */
class SelfOrderPortalTimezoneBoundaryTest {

    @Test
    void utcMidnightWindow() {
        ZoneId zone = ZoneId.of("UTC");
        ZonedDateTime startZ = ZonedDateTime.now(zone).toLocalDate().atStartOfDay(zone);
        Instant from = startZ.toInstant();
        Instant to = startZ.plusDays(1).toInstant();
        assertThat(to).isAfter(from);
        assertThat(LocalDate.ofInstant(from, zone)).isEqualTo(LocalDate.now(zone));
    }

    @Test
    void africaAccraNoDst() {
        ZoneId zone = ZoneId.of("Africa/Accra");
        Instant from = ZonedDateTime.now(zone).toLocalDate().atStartOfDay(zone).toInstant();
        Instant boundary = ZonedDateTime.now(zone).toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
        assertThat(boundary.toEpochMilli() - from.toEpochMilli()).isEqualTo(86_400_000L);
    }
}
