/** Parse API timestamps (ISO string, epoch ms/sec, or Jackson array). */
export function parseApiInstant(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Values below ~2001 in ms are almost certainly epoch seconds.
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? t : null;
  }

  if (Array.isArray(value) && value.length >= 3) {
    const [y, m, d, h = 0, min = 0, s = 0] = value as number[];
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d, h, min, s).getTime();
  }

  return null;
}

export function elapsedMinutesSince(openedAt: unknown): number {
  const openedMs = parseApiInstant(openedAt);
  if (openedMs == null) return 0;
  return Math.max(0, Math.floor((Date.now() - openedMs) / 60_000));
}

export function formatShiftDuration(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
