"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ReservationWizard } from "@/features/reservations/ReservationWizard";

export default function NewStaffReservationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);

  return (
    <ReservationWizard
      hotelId={hotelId}
      walkIn={searchParams.get("type") === "walkin"}
      groupId={searchParams.get("groupId")}
      initialCheckIn={searchParams.get("check_in")}
      initialCheckOut={searchParams.get("check_out")}
      initialRoomTypeId={searchParams.get("room_type_id")}
      initialAdults={searchParams.get("adults")}
    />
  );
}
