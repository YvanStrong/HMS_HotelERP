package com.hms.api;

import com.hms.entity.*;
import com.hms.repository.HotelRepository;
import com.hms.repository.RoomRepository;
import com.hms.service.IoTDeviceService;
import com.hms.web.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * IoT device management + energy dashboard endpoints.
 */
@RestController
@RequestMapping("/api/v1/hotels/{hotelId}/iot")
public class IoTController {

    private final IoTDeviceService iotService;
    private final HotelRepository hotelRepo;
    private final RoomRepository roomRepo;

    public IoTController(IoTDeviceService iotService, HotelRepository hotelRepo, RoomRepository roomRepo) {
        this.iotService = iotService;
        this.hotelRepo = hotelRepo;
        this.roomRepo = roomRepo;
    }

    @GetMapping("/devices")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public List<RoomDevice> listDevices(@PathVariable UUID hotelId) {
        return iotService.listDevices(hotelId);
    }

    @GetMapping("/rooms/{roomId}/devices")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST','ROLE_HOUSEKEEPING')")
    public List<RoomDevice> listDevicesForRoom(
            @PathVariable UUID hotelId, @PathVariable UUID roomId) {
        return iotService.listDevicesForRoom(roomId);
    }

    @PostMapping("/devices")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ResponseEntity<RoomDevice> registerDevice(
            @PathVariable UUID hotelId,
            @RequestBody Map<String, Object> body) {
        RoomDevice device = new RoomDevice();
        device.setHotel(hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found")));
        device.setRoom(roomRepo.findById(UUID.fromString(body.get("roomId").toString()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND", "Room not found")));
        device.setDeviceType(body.getOrDefault("deviceType", "LIGHT").toString());
        device.setDeviceName(body.getOrDefault("deviceName", "Unnamed Device").toString());
        device.setProtocol(body.getOrDefault("protocol", "REST").toString());
        device.setEndpoint((String) body.get("endpoint"));
        return ResponseEntity.status(HttpStatus.CREATED).body(iotService.registerDevice(device));
    }

    @DeleteMapping("/devices/{deviceId}")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ResponseEntity<Void> removeDevice(
            @PathVariable UUID hotelId, @PathVariable UUID deviceId) {
        iotService.removeDevice(deviceId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/devices/{deviceId}/state")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public Map<String, Object> getDeviceState(
            @PathVariable UUID hotelId, @PathVariable UUID deviceId) {
        return iotService.getDeviceState(deviceId);
    }

    @PostMapping("/devices/{deviceId}/state")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER','ROLE_RECEPTIONIST')")
    public DeviceStateLog setDeviceState(
            @PathVariable UUID hotelId,
            @PathVariable UUID deviceId,
            @RequestBody Map<String, Object> body) {
        String stateJson = body.getOrDefault("state", "{}").toString();
        String source = body.getOrDefault("source", "STAFF").toString();
        return iotService.setDeviceState(deviceId, stateJson, source);
    }

    // --- Energy Dashboard ---

    @GetMapping("/energy/summary")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN','ROLE_MANAGER')")
    public Map<String, Object> energySummary(
            @PathVariable UUID hotelId,
            @RequestParam(defaultValue = "7") int days) {
        Instant to = Instant.now();
        Instant from = to.minus(days, ChronoUnit.DAYS);
        return iotService.getEnergySummary(hotelId, from, to);
    }

    @PostMapping("/energy/readings")
    @PreAuthorize("hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_HOTEL_ADMIN')")
    public ResponseEntity<EnergyReading> recordReading(
            @PathVariable UUID hotelId,
            @RequestBody Map<String, Object> body) {
        EnergyReading reading = new EnergyReading();
        reading.setHotel(hotelRepo.findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "HOTEL_NOT_FOUND", "Hotel not found")));
        if (body.containsKey("roomId")) {
            reading.setRoom(roomRepo.findById(UUID.fromString(body.get("roomId").toString())).orElse(null));
        }
        reading.setReadingType(body.getOrDefault("readingType", "ELECTRICITY").toString());
        reading.setValue(new BigDecimal(body.getOrDefault("value", "0").toString()));
        reading.setUnit(body.getOrDefault("unit", "kWh").toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(iotService.recordReading(reading));
    }
}
