"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { staffAppPath } from "@/lib/staffAppRoutes";

export default function RoomTypeDetailPlaceholderPage() {
  const params = useParams();
  const roomTypeId = String(params.roomTypeId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Room Type</h1>
      <p className="text-sm text-muted-foreground">
        Room type details page placeholder for <code>{roomTypeId}</code>.
      </p>
      <div className="flex gap-2">
        <Link href={staffAppPath("room-types")} className="hms-btn-outline">
          Back to room types
        </Link>
        <Link href={staffAppPath("room-types", roomTypeId, "rates")} className="hms-btn-solid">
          Open rates
        </Link>
      </div>
    </div>
  );
}
