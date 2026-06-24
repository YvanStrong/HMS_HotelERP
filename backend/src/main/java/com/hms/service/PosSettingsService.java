package com.hms.service;

import com.hms.entity.Hotel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PosSettingsService {

    private final boolean globalRequireShift;
    private final int globalLowStockThreshold;

    public PosSettingsService(
            @Value("${hms.pos.require-shift:true}") boolean globalRequireShift,
            @Value("${hms.pos.low-stock-threshold:5}") int globalLowStockThreshold) {
        this.globalRequireShift = globalRequireShift;
        this.globalLowStockThreshold = globalLowStockThreshold > 0 ? globalLowStockThreshold : 5;
    }

    /** When true, mobile POS must open a shift before taking orders. */
    public boolean resolveRequireShift(Hotel hotel) {
        if (hotel == null) {
            return globalRequireShift;
        }
        if (hotel.getPosRequireShift() != null) {
            return hotel.getPosRequireShift();
        }
        return globalRequireShift;
    }

    /** Units at or below this level show a low-stock badge on the mobile menu. */
    public int resolveLowStockThreshold(Hotel hotel) {
        if (hotel == null) {
            return globalLowStockThreshold;
        }
        if (hotel.getPosLowStockThreshold() != null && hotel.getPosLowStockThreshold() > 0) {
            return hotel.getPosLowStockThreshold();
        }
        return globalLowStockThreshold;
    }
}
