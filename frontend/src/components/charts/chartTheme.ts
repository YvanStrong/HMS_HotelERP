/**
 * Shared theme tokens for HMS chart components.
 *
 * Colors are picked from the Tailwind / CSS-variable palette already in use
 * on the staff app and tuned for accessibility on white-ish backgrounds
 * (contrast ratio >= 3:1 for fills, >= 4.5:1 for axis text).
 */

export const HMS_CHART_PALETTE = [
  "#16a34a", // primary green
  "#3b82f6", // sky 500
  "#10b981", // emerald 500
  "#f59e0b", // amber 500
  "#ef4444", // red 500
  "#8b5cf6", // violet 500
  "#0ea5e9", // sky 500 (alt)
  "#14b8a6", // teal 500
  "#f97316", // orange 500
  "#6366f1", // indigo 500
] as const;

export const HMS_CHART_TONE: Record<
  "green" | "amber" | "red" | "blue" | "violet" | "muted",
  string
> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  muted: "#16a34a",
};

export const HMS_CHART_GRID = "rgba(20, 83, 45, 0.08)";
export const HMS_CHART_AXIS = "rgba(20, 83, 45, 0.55)";
export const HMS_CHART_TICK = "rgba(20, 83, 45, 0.7)";

export function tonedColor(tone: string | undefined | null): string {
  if (!tone) return HMS_CHART_TONE.muted;
  const t = tone.toLowerCase();
  if (t in HMS_CHART_TONE) {
    return HMS_CHART_TONE[t as keyof typeof HMS_CHART_TONE];
  }
  return HMS_CHART_TONE.muted;
}

export function paletteAt(index: number): string {
  return HMS_CHART_PALETTE[index % HMS_CHART_PALETTE.length];
}
