import { Modal, Pressable, Text, View } from "react-native";

const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

type Props = {
  visible: boolean;
  defaultCount?: number;
  onSelect: (count: number) => void;
  onSkip: () => void;
};

export function GuestCountModal({ visible, defaultCount = 1, onSelect, onSkip }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full max-w-sm rounded-2xl bg-white p-5">
          <Text className="text-center text-lg font-bold text-slate-900">How many guests?</Text>
          <View className="mt-4 flex-row flex-wrap justify-center gap-2">
            {COUNTS.map((n) => (
              <Pressable
                key={n}
                onPress={() => onSelect(n)}
                className={`h-14 w-14 items-center justify-center rounded-xl ${
                  n === defaultCount ? "bg-indigo-600" : "bg-slate-100"
                }`}
              >
                <Text
                  className={`text-lg font-bold ${n === defaultCount ? "text-white" : "text-slate-800"}`}
                >
                  {n === 8 ? "8+" : n}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onSkip} className="mt-4 py-2">
            <Text className="text-center text-sm text-slate-500">Skip (1 guest)</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
