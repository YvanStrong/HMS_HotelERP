import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { TicketRow } from "../api/tickets";

type Props = {
  visible: boolean;
  currentTicketId: string;
  currentTableLabel: string;
  tickets: TicketRow[];
  loading: boolean;
  onSelect: (ticket: TicketRow) => void;
  onClose: () => void;
};

export function MergeTicketModal({
  visible,
  currentTicketId,
  currentTableLabel,
  tickets,
  loading,
  onSelect,
  onClose,
}: Props) {
  const others = tickets.filter((t) => t.id !== currentTicketId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[75%] rounded-t-2xl bg-white px-4 pb-8 pt-4">
          <Text className="mb-1 text-lg font-bold text-slate-900">Merge with another table</Text>
          <Text className="mb-4 text-sm text-slate-500">
            Items will move into Table {currentTableLabel}
          </Text>
          {loading ? (
            <ActivityIndicator color="#4f46e5" className="py-8" />
          ) : others.length === 0 ? (
            <Text className="py-8 text-center text-slate-500">No other open tickets in this outlet</Text>
          ) : (
            <ScrollView>
              {others.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => onSelect(t)}
                  className="mb-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <Text className="font-semibold text-slate-900">Table {t.tableLabel}</Text>
                  <Text className="text-sm text-slate-500">
                    {t.lineCount} items{t.waiterName ? ` · ${t.waiterName}` : ""}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Pressable onPress={onClose} className="mt-4 rounded-xl bg-slate-100 py-3">
            <Text className="text-center font-medium text-slate-700">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
