import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import type { Depot } from "../types";

type Props = {
  visible: boolean;
  depot: Depot;
  waiterName: string;
  busy: boolean;
  onStart: (openingFloat: number) => void;
  onSkip: () => void;
  onClose: () => void;
};

export function OpenShiftModal({ visible, depot, waiterName, busy, onStart, onSkip, onClose }: Props) {
  const [floatText, setFloatText] = useState("0");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <Text className="text-xl font-bold text-slate-900">Start Your Shift</Text>
          <Text className="mt-2 text-sm text-slate-600">Waiter: {waiterName}</Text>
          <Text className="text-sm text-slate-600">Outlet: {depot.name}</Text>
          <Text className="text-sm text-slate-500">
            {new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </Text>

          <Text className="mt-4 text-sm text-slate-600">
            This shift covers every outlet (restaurant, bar, etc.). Sales from all outlets are combined when you close.
          </Text>
          <Text className="mb-2 mt-5 text-sm font-medium text-slate-700">How much cash is in the drawer?</Text>
          <TextInput
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900"
            keyboardType="decimal-pad"
            value={floatText}
            onChangeText={setFloatText}
            placeholder="0"
          />

          <Pressable
            disabled={busy}
            onPress={() => onStart(Number.parseFloat(floatText) || 0)}
            className="mt-5 items-center rounded-xl bg-indigo-600 py-4"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Start Shift</Text>
            )}
          </Pressable>

          <Pressable disabled={busy} onPress={onSkip} className="mt-3 items-center py-2">
            <Text className="text-sm text-slate-500">Skip (No Shift)</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
