import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Depot } from "../types";

type Props = {
  depot: Depot;
  productCount: number;
  onPress: () => void;
};

const TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurant",
  BAR: "Bar",
  BARISTA: "Café",
  CUISINE: "Kitchen",
  PRINCIPAL: "Main outlet",
  PATISSERIE: "Patisserie",
  OTHER: "Outlet",
};

export function OutletCard({ depot, productCount, onPress }: Props) {
  const typeLabel = TYPE_LABELS[depot.depotType?.toUpperCase() ?? ""] ?? depot.depotType ?? "Outlet";

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-2xl border border-indigo-100 bg-white p-4 active:bg-indigo-50"
    >
      <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
        <Ionicons name="restaurant-outline" size={24} color="#4f46e5" />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-slate-900">{depot.name}</Text>
        <Text className="text-sm text-slate-500">{typeLabel}</Text>
      </View>
      <View className="rounded-full bg-indigo-600 px-3 py-1">
        <Text className="text-xs font-semibold text-white">{productCount} items</Text>
      </View>
    </Pressable>
  );
}
