import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useShiftElapsedMinutes } from "../hooks/useShiftElapsedMinutes";
import { formatShiftDuration } from "../lib/shiftDuration";
import { useShiftStore } from "../store/shiftStore";

type Props = {
  variant?: "badge" | "duration";
};

export function ShiftHeaderBadge({ variant = "badge" }: Props) {
  const router = useRouter();
  const activeShift = useShiftStore((s) => s.activeShift);
  const isShiftOpen = useShiftStore((s) => s.isShiftOpen);
  const elapsed = useShiftElapsedMinutes(activeShift?.openedAt, isShiftOpen);

  if (variant === "duration" && isShiftOpen && activeShift) {
    return (
      <Pressable onPress={() => router.push("/(main)/close-shift")} className="rounded-full bg-emerald-50 px-3 py-1">
        <Text className="text-xs font-medium text-emerald-700">Shift: {formatShiftDuration(elapsed)}</Text>
      </Pressable>
    );
  }

  if (isShiftOpen) {
    return (
      <Pressable onPress={() => router.push("/(main)/close-shift")} className="rounded-full bg-emerald-100 px-3 py-1.5">
        <View className="flex-row items-center gap-1">
          <View className="h-2 w-2 rounded-full bg-emerald-500" />
          <Text className="text-xs font-semibold text-emerald-800">Shift Open · {formatShiftDuration(elapsed)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => router.push("/(main)/outlets")} className="rounded-full bg-slate-100 px-3 py-1.5">
      <Text className="text-xs text-slate-500">No Active Shift</Text>
    </Pressable>
  );
}
