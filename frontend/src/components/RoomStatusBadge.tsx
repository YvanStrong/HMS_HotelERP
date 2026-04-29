"use client";

import { roomStatusColor, roomStatusLabel } from "@/lib/roomStatusDisplay";

export function RoomStatusBadge({ status }: { status: string }) {
  const bg = roomStatusColor(status);
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: bg }}
    >
      {roomStatusLabel(status)}
    </span>
  );
}
