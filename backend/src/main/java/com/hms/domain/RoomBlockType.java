package com.hms.domain;

/** Courtesy hold, maintenance blackout, VIP pre-assignment, or corporate block (spec §2 holds). */
public enum RoomBlockType {
    COURTESY_HOLD,
    MAINTENANCE,
    VIP_PRE_ASSIGN,
    CORPORATE_BLOCK
}
