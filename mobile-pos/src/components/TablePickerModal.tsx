import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { PosTableRow } from "../api/tickets";

type Props = {
  visible: boolean;
  title: string;
  tables: PosTableRow[];
  currentTableId?: string | null;
  onSelect: (table: PosTableRow) => void;
  onClose: () => void;
};

export function TablePickerModal({
  visible,
  title,
  tables,
  currentTableId,
  onSelect,
  onClose,
}: Props) {
  const available = tables.filter(
    (t) => t.id !== currentTableId && t.active !== false && !t.occupied,
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[75%] rounded-t-2xl bg-white px-4 pb-8 pt-4">
          <Text className="mb-1 text-lg font-bold text-slate-900">{title}</Text>
          <Text className="mb-4 text-sm text-slate-500">Green tables are available</Text>
          <ScrollView>
            {available.length === 0 ? (
              <Text className="py-8 text-center text-slate-500">No available tables</Text>
            ) : (
              available.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => onSelect(t)}
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                >
                  <Text className="font-semibold text-slate-900">{t.tableLabel}</Text>
                  <Text className="text-xs text-emerald-700">Available</Text>
                </Pressable>
              ))
            )}
            {tables
              .filter((t) => t.id !== currentTableId && (t.occupied || t.active === false))
              .map((t) => (
                <View
                  key={`busy-${t.id}`}
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 opacity-60"
                >
                  <Text className="font-medium text-slate-500">{t.tableLabel}</Text>
                  <Text className="text-xs text-slate-400">
                    {t.active === false ? "Inactive" : "Occupied"}
                  </Text>
                </View>
              ))}
          </ScrollView>
          <Pressable onPress={onClose} className="mt-4 rounded-xl bg-slate-100 py-3">
            <Text className="text-center font-medium text-slate-700">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
