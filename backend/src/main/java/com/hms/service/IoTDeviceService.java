package com.hms.service;

import com.hms.entity.*;
import com.hms.repository.*;
import com.hms.web.ApiException;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IoT device management service — manages smart room devices,
 * state commands, and energy readings.
 *
 * <p>Phase 1: CRUD + mock device interactions. Phase 2: real protocol adapters (MQTT, REST).
 */
@Service
public class IoTDeviceService {

    private static final Logger log = LoggerFactory.getLogger(IoTDeviceService.class);

    private final RoomDeviceRepository deviceRepo;
    private final DeviceStateLogRepository stateLogRepo;
    private final EnergyReadingRepository energyRepo;
    private final HotelRepository hotelRepo;

    public IoTDeviceService(RoomDeviceRepository deviceRepo,
                             DeviceStateLogRepository stateLogRepo,
                             EnergyReadingRepository energyRepo,
                             HotelRepository hotelRepo) {
        this.deviceRepo = deviceRepo;
        this.stateLogRepo = stateLogRepo;
        this.energyRepo = energyRepo;
        this.hotelRepo = hotelRepo;
    }

    // --- Device CRUD ---

    @Transactional(readOnly = true)
    public List<RoomDevice> listDevices(UUID hotelId) {
        return deviceRepo.findByHotel_IdOrderByDeviceName(hotelId);
    }

    @Transactional(readOnly = true)
    public List<RoomDevice> listDevicesForRoom(UUID roomId) {
        return deviceRepo.findByRoom_IdOrderByDeviceName(roomId);
    }

    @Transactional
    public RoomDevice registerDevice(RoomDevice device) {
        device.setStatus("OFFLINE");
        log.info("IoT device registered: type={} room={}", device.getDeviceType(), device.getRoom().getId());
        return deviceRepo.save(device);
    }

    @Transactional
    public void removeDevice(UUID deviceId) {
        deviceRepo.deleteById(deviceId);
    }

    // --- Device State ---

    /**
     * Get the current state of a device.
     * Phase 1: returns last logged state. Phase 2: queries device in real-time.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getDeviceState(UUID deviceId) {
        RoomDevice device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DEVICE_NOT_FOUND", "Device not found."));

        Page<DeviceStateLog> lastState = stateLogRepo.findByDevice_IdOrderByRecordedAtDesc(
                deviceId, PageRequest.of(0, 1));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deviceId", device.getId());
        result.put("deviceType", device.getDeviceType());
        result.put("status", device.getStatus());
        result.put("lastHeartbeat", device.getLastHeartbeat());

        if (!lastState.isEmpty()) {
            result.put("currentState", lastState.getContent().get(0).getState());
            result.put("stateRecordedAt", lastState.getContent().get(0).getRecordedAt());
        }
        return result;
    }

    /**
     * Send a state command to a device.
     * Phase 1: logs the command. Phase 2: routes via protocol adapter.
     */
    @Transactional
    public DeviceStateLog setDeviceState(UUID deviceId, String stateJson, String source) {
        RoomDevice device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DEVICE_NOT_FOUND", "Device not found."));

        DeviceStateLog entry = new DeviceStateLog();
        entry.setDevice(device);
        entry.setState(stateJson);
        entry.setSource(source);

        // Phase 1: mark device as responding
        device.setLastHeartbeat(Instant.now());
        device.setStatus("ONLINE");
        deviceRepo.save(device);

        log.info("Device {} state set: source={} state={}", deviceId, source, stateJson);
        return stateLogRepo.save(entry);
    }

    // --- Energy Readings ---

    @Transactional
    public EnergyReading recordReading(EnergyReading reading) {
        return energyRepo.save(reading);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getEnergySummary(UUID hotelId, Instant from, Instant to) {
        List<Object[]> sums = energyRepo.sumByTypeForPeriod(hotelId, from, to);
        Map<String, Object> result = new LinkedHashMap<>();
        for (Object[] row : sums) {
            result.put((String) row[0], row[1]);
        }
        return result;
    }
}
