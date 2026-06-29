import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CartLine } from "../types";
import { ProductPhoto } from "./ProductPhoto";

const styles = StyleSheet.create({
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    overflow: "hidden",
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
});

type Props = {
  line: CartLine;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
};

export function CartLineItem({ line, onDecrease, onIncrease, onRemove }: Props) {
  const lineTotal = line.qty * line.unitPrice;

  return (
    <View className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
      <View className="flex-row items-start justify-between">
        {line.imageUrl ? (
          <View style={styles.thumb}>
            <ProductPhoto photoUrl={line.imageUrl} height={56} />
          </View>
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="fast-food-outline" size={20} color="#94a3b8" />
          </View>
        )}
        <View className="flex-1 pr-2">
          <Text className="font-semibold text-slate-900">{line.productName}</Text>
          {line.notes ? <Text className="mt-1 text-xs text-slate-500">Note: {line.notes}</Text> : null}
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </Pressable>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable onPress={onDecrease} className="h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <Ionicons name="remove" size={16} color="#334155" />
          </Pressable>
          <Text className="mx-3 min-w-[24px] text-center font-semibold">{line.qty}</Text>
          <Pressable onPress={onIncrease} className="h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
            <Ionicons name="add" size={16} color="#4f46e5" />
          </Pressable>
        </View>
        <Text className="font-bold text-slate-900">{lineTotal.toFixed(2)}</Text>
      </View>
    </View>
  );
}
