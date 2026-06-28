import { useMutation } from "@tanstack/react-query";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { apiErrorMessage } from "../api/client";
import { cancelTicket, money, type TicketDetail } from "../api/tickets";
import type { CartLine } from "../types";

type Props = {
  visible: boolean;
  ticket: TicketDetail | null | undefined;
  pendingLines: CartLine[];
  tableLabel: string;
  hotelId: string;
  ticketId: string | null;
  isLocalOnly: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirmLocal: () => void;
  onConfirmServer: () => void;
};

export function CancelTicketModal({
  visible,
  ticket,
  pendingLines,
  tableLabel,
  busy,
  onClose,
  onConfirmLocal,
  onConfirmServer,
  isLocalOnly,
}: Props) {
  const serverLines = ticket?.lines.filter((l) => !l.voided && l.lineStatus !== "CANCELLED") ?? [];
  const items = [
    ...serverLines.map((l) => ({ key: l.id, label: `${money(l.quantity)}× ${l.productName}` })),
    ...pendingLines.map((l) => ({ key: l.productId, label: `${l.qty}× ${l.productName} (pending)` })),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="max-h-[85%] w-full max-w-md rounded-2xl bg-white p-6">
          <Text className="text-xl font-bold text-slate-900">Cancel this ticket?</Text>
          <Text className="mt-2 text-sm text-slate-600">
            Table {tableLabel} will be freed. This cannot be undone.
          </Text>

          {items.length > 0 ? (
            <ScrollView className="mt-4 max-h-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              {items.map((item) => (
                <Text key={item.key} className="py-1 text-sm text-slate-700">
                  · {item.label}
                </Text>
              ))}
            </ScrollView>
          ) : (
            <Text className="mt-4 text-sm text-slate-500">No items on this ticket.</Text>
          )}

          <Pressable
            disabled={busy}
            onPress={isLocalOnly ? onConfirmLocal : onConfirmServer}
            className="mt-5 items-center rounded-xl bg-red-600 py-4"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Cancel Ticket</Text>
            )}
          </Pressable>

          <Pressable disabled={busy} onPress={onClose} className="mt-3 items-center py-2">
            <Text className="font-medium text-slate-600">Keep Ticket</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function useCancelTicketMutation(
  hotelId: string,
  ticketId: string,
  tableLabel: string,
  onSuccess: () => void,
) {
  return useMutation({
    mutationFn: () => cancelTicket(hotelId, ticketId),
    onSuccess: () => {
      Toast.show({
        type: "success",
        text1: "Ticket cancelled",
        text2: `Table ${tableLabel} is free`,
      });
      onSuccess();
    },
    onError: (err) =>
      Toast.show({ type: "error", text1: "Could not cancel", text2: apiErrorMessage(err) }),
  });
}
