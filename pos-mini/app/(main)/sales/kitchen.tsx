import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../src/components/StatusBadge';
import {
  listKitchenTickets,
  parseKitchenItems,
  updateKitchenTicketStatus,
} from '../../../src/repositories/kitchenTicketRepository';
import type { KitchenTicket, KitchenTicketStatus } from '../../../src/types';

const STATUS_FLOW: Record<KitchenTicketStatus, KitchenTicketStatus | null> = {
  pending: 'preparing',
  preparing: 'done',
  done: null,
};

export default function KitchenScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);

  const load = useCallback(async () => {
    setTickets(await listKitchenTickets());
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const advance = async (ticket: KitchenTicket) => {
    const next = STATUS_FLOW[ticket.status];
    if (!next) return;
    await updateKitchenTicketStatus(ticket.id, next);
    await load();
    Toast.show({ type: 'success', text1: `Ticket ${next}` });
  };

  return (
    <ScreenContainer>
      <Pressable
        onPress={() => router.push('/(main)/sales')}
        className="mb-3 rounded-xl border border-app-border bg-app-surface py-2"
      >
        <Text className="text-center font-semibold text-app-text">← Back to sales</Text>
      </Pressable>

      <ScreenList>
        {tickets.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-app-muted">No kitchen tickets</Text>
          </View>
        ) : (
          tickets.map((ticket) => {
            const items = parseKitchenItems(ticket.itemsJson);
            return (
              <View key={ticket.id} className="mb-3 rounded-xl border border-app-border bg-app-surface p-4">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="font-bold text-app-text">{ticket.invoiceNumber}</Text>
                  <StatusBadge label={ticket.status} tone={ticket.status === 'pending' ? 'warning' : 'info'} />
                </View>
                <Text className="mb-2 text-xs text-app-muted">
                  {new Date(ticket.createdAt).toLocaleString()}
                </Text>
                {items.map((item, idx) => (
                  <Text key={idx} className="text-app-text">
                    {item.quantity}× {item.productName}
                    {item.variantName ? ` (${item.variantName})` : ''}
                    {item.modifiers?.length
                      ? ` — ${item.modifiers.map((m) => m.optionName).join(', ')}`
                      : ''}
                  </Text>
                ))}
                {STATUS_FLOW[ticket.status] ? (
                  <Pressable
                    onPress={() => void advance(ticket)}
                    className="mt-3 rounded-xl bg-app-primary py-3"
                  >
                    <Text className="text-center font-semibold text-white">
                      Mark {STATUS_FLOW[ticket.status]}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScreenList>
    </ScreenContainer>
  );
}
