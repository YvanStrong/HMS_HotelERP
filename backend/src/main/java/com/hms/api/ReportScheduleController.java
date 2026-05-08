package com.hms.api;

import com.hms.entity.ReportSchedule;
import com.hms.repository.HotelRepository;
import com.hms.repository.ReportScheduleRepository;
import com.hms.web.ApiException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/report-schedules")
public class ReportScheduleController {

    private final ReportScheduleRepository scheduleRepo;
    private final HotelRepository hotelRepo;

    public ReportScheduleController(ReportScheduleRepository scheduleRepo, HotelRepository hotelRepo) {
        this.scheduleRepo = scheduleRepo;
        this.hotelRepo = hotelRepo;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<ReportSchedule> list(@PathVariable UUID hotelId) {
        return scheduleRepo.findByHotel_IdOrderByCreatedAtDesc(hotelId);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<ReportSchedule> create(
            @PathVariable UUID hotelId, @RequestBody Map<String, Object> body) {
        ReportSchedule s = new ReportSchedule();
        s.setHotel(hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "")));
        s.setReportType(body.getOrDefault("reportType", "OCCUPANCY").toString());
        s.setFrequency(body.getOrDefault("frequency", "DAILY").toString());
        s.setRecipients(body.getOrDefault("recipients", "").toString());
        s.setFormat(body.getOrDefault("format", "PDF").toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(scheduleRepo.save(s));
    }

    @DeleteMapping("/{scheduleId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable UUID hotelId, @PathVariable UUID scheduleId) {
        scheduleRepo.deleteById(scheduleId);
        return ResponseEntity.noContent().build();
    }
}
