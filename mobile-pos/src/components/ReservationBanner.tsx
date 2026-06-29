import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import type { TicketDetail } from "../api/tickets";

type Props = {
  ticket: TicketDetail;
};

export function ReservationBanner({ ticket }: Props) {
  const [open, setOpen] = useState(false);
  if (!ticket.reservationId) return null;

  const guestName = ticket.customerName ?? "Guest";
  const room = ticket.roomNumber;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="mx-4 mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3"
      >
        <Text className="font-semibold text-indigo-900">
          🏨 {guestName}
          {room ? ` · Room ${room}` : ""}
        </Text>
        {ticket.dietaryNotes ? (
          <Text className="mt-1 text-xs font-medium text-amber-700">⚠️ Dietary restrictions on file</Text>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="rounded-t-2xl bg-white px-5 pb-8 pt-5" onPress={(e) => e.stopPropagation()}>
            <Text className="text-lg font-bold text-slate-900">{guestName}</Text>
            {room ? <Text className="mt-1 text-slate-600">Room {room}</Text> : null}
            {ticket.guestCount ? (
              <Text className="mt-1 text-slate-600">{ticket.guestCount} guests</Text>
            ) : null}
            {ticket.reservationCheckInTime ? (
              <Text className="mt-1 text-slate-600">Check-in: {ticket.reservationCheckInTime}</Text>
            ) : null}
            {ticket.dietaryNotes ? (
              <Text className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠️ Dietary: {ticket.dietaryNotes}
              </Text>
            ) : null}
            {ticket.reservationSpecialRequests ? (
              <Text className="mt-2 text-sm text-slate-600">
                📝 {ticket.reservationSpecialRequests}
              </Text>
            ) : null}
            <Pressable onPress={() => setOpen(false)} className="mt-5 rounded-xl bg-slate-100 py-3">
              <Text className="text-center font-medium text-slate-700">Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
