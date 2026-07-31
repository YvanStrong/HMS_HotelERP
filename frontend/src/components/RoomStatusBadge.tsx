"use client";

import { roomStatusColor, roomStatusLabel } from "@/lib/roomStatusDisplay";

type RoomStatusBadgeProps = {
  status: string;
  /** Compact badge for dense room cards */
  size?: "sm" | "md";
};

export function RoomStatusBadge({ status, size = "md" }: RoomStatusBadgeProps) {
  const bg = roomStatusColor(status);
  const sizeClass =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      : "px-2 py-0.5 text-xs font-semibold";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md text-white ${sizeClass}`}
      style={{ backgroundColor: bg }}
    >
      {roomStatusLabel(status)}
    </span>
  );
}
