import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { useCardStyle } from '../../../src/hooks/useTheme';
import { getRefundWithItems } from '../../../src/repositories/refundRepository';
import type { Refund, RefundItem } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

export default function RefundDetailScreen() {
  const cardStyle = useCardStyle();
  const { refundId } = useLocalSearchParams<{ refundId: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [refund, setRefund] = useState<Refund | null>(null);
  const [items, setItems] = useState<RefundItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!refundId) return;
      void getRefundWithItems(refundId).then((r) => {
        if (r) {
          setRefund(r);
          setItems(r.items ?? []);
        }
      });
    }, [refundId]),
  );

  if (!refund) {
    return (
      <ScreenContainer>
        <Text className="text-app-text">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
        <View className="p-4" style={cardStyle}>
          <Text className="text-lg font-bold text-app-text">{refund.refundNumber}</Text>
          <Text className="text-sm text-gray-600">{new Date(refund.createdAt).toLocaleString()}</Text>
          {refund.saleInvoiceNumber ? (
            <Text className="mt-1 text-sm text-app-text">Sale: {refund.saleInvoiceNumber}</Text>
          ) : null}
          {refund.reason ? (
            <Text className="mt-1 text-sm text-gray-600">Reason: {refund.reason}</Text>
          ) : null}
          <View className="my-3 border-t-2 border-app-border" />
          {items.map((item) => (
            <View key={item.id} className="mb-2 flex-row justify-between">
              <Text className="flex-1 text-sm text-app-text">
                {item.productName} × {item.quantity}
              </Text>
              <Text className="text-sm font-bold text-app-text">
                {formatMoney(item.lineTotal, settings)}
              </Text>
            </View>
          ))}
          <View className="my-3 border-t-2 border-app-border" />
          <View className="flex-row justify-between">
            <Text className="text-lg font-bold text-app-text">Total</Text>
            <Text className="text-lg font-bold text-app-text">{formatMoney(refund.total, settings)}</Text>
          </View>
        </View>
        {refund.saleId ? (
          <Pressable
            onPress={() => router.push(`/(main)/sales/${refund.saleId}`)}
            className="mt-4 border-2 border-app-border bg-app-surface py-3"
          >
            <Text className="text-center font-bold text-app-text">View Original Sale</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/(main)/refunds/history')}
          className="mt-2 border-2 border-app-border bg-app-primary py-3"
        >
          <Text className="text-center font-bold text-white">All Refunds</Text>
        </Pressable>
    </ScreenContainer>
  );
}
