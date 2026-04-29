/** Operational room status colors (Phase 1 spec). */
export const ROOM_STATUS_COLORS: Record<string, string> = {
  OCCUPIED: "#DC2626",
  VACANT_CLEAN: "#16A34A",
  VACANT_DIRTY: "#EA580C",
  INSPECTED: "#2563EB",
  BLOCKED: "#CA8A04",
  OUT_OF_ORDER: "#6B7280",
  UNDER_MAINTENANCE: "#9333EA",
  RESERVED: "#4F46E5",
};

export function roomStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function roomStatusColor(status: string): string {
  return ROOM_STATUS_COLORS[status] ?? "#64748B";
}
