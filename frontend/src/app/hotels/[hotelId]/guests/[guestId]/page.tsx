"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { staffAppPath } from "@/lib/staffAppRoutes";

export default function GuestDetailPlaceholderPage() {
  const params = useParams();
  const guestId = String(params.guestId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Guest Profile</h1>
      <p className="text-sm text-muted-foreground">
        Guest details placeholder for <code>{guestId}</code>.
      </p>
      <Link href={staffAppPath("guests")} className="hms-btn-outline">
        Back to guests
      </Link>
    </div>
  );
}
