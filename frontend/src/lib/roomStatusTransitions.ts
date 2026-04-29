/** Mirrors backend `RoomStatusTransitions` (Phase 1 Step 3). */
const NEXT: Record<string, string[]> = {
  VACANT_CLEAN: ["OCCUPIED", "BLOCKED", "OUT_OF_ORDER", "UNDER_MAINTENANCE"],
  VACANT_DIRTY: ["VACANT_CLEAN", "UNDER_MAINTENANCE", "OUT_OF_ORDER"],
  OCCUPIED: ["VACANT_DIRTY", "BLOCKED"],
  INSPECTED: ["OCCUPIED", "BLOCKED", "UNDER_MAINTENANCE"],
  BLOCKED: ["VACANT_CLEAN", "INSPECTED", "VACANT_DIRTY"],
  UNDER_MAINTENANCE: ["VACANT_DIRTY"],
  OUT_OF_ORDER: ["VACANT_DIRTY", "UNDER_MAINTENANCE"],
  RESERVED: ["OCCUPIED", "BLOCKED", "VACANT_CLEAN", "VACANT_DIRTY"],
};

export function allowedNextStatuses(current: string | null | undefined): string[] {
  if (!current) return [];
  return NEXT[current] ?? [];
}
