import { Modal, Pressable, Text, View } from "react-native";
import type { ReservationHint } from "../types";

type Props = {
  visible: boolean;
  hint: ReservationHint | null;
  onOpenLinked: () => void;
  onOpenWithoutLink: () => void;
  onClose: () => void;
};

export function ReservationHintBanner({
  visible,
  hint,
  onOpenLinked,
  onOpenWithoutLink,
  onClose,
}: Props) {
  if (!hint) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-slate-900">🏨 Reservation: {hint.guestName}</Text>
          <Text className="mt-2 text-sm text-slate-600">
            {hint.guestCount} guests · Check-in {hint.checkInTime}
            {hint.roomNumber ? ` · Room ${hint.roomNumber}` : ""}
          </Text>
          {hint.dietaryNotes ? (
            <Text className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠️ Dietary: {hint.dietaryNotes}
            </Text>
          ) : null}
          {hint.specialRequests ? (
            <Text className="mt-2 text-sm text-slate-600">📝 Notes: {hint.specialRequests}</Text>
          ) : null}

          <Pressable onPress={onOpenLinked} className="mt-5 rounded-xl bg-indigo-600 py-4">
            <Text className="text-center font-semibold text-white">Open for {hint.guestName}</Text>
          </Pressable>
          <Pressable onPress={onOpenWithoutLink} className="mt-3 rounded-xl border border-slate-200 py-3">
            <Text className="text-center font-medium text-slate-700">Open Without Link</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
