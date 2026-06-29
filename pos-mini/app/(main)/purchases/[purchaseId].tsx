import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { cardStyle } from '../../../src/constants/theme';
import { getPurchaseWithItems } from '../../../src/repositories/purchaseRepository';
import type { Purchase, PurchaseItem } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

export default function PurchaseDetailScreen() {
  const { purchaseId } = useLocalSearchParams<{ purchaseId: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!purchaseId) return;
      void getPurchaseWithItems(purchaseId).then((p) => {
        if (p) {
          setPurchase(p);
          setItems(p.items ?? []);
        }
      });
    }, [purchaseId]),
  );

  if (!purchase) {
    return (
      <ScreenContainer>
        <Text className="text-app-text">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
        <View className="p-4" style={cardStyle}>
          <Text className="text-lg font-bold text-black">{purchase.poNumber}</Text>
          <Text className="text-sm text-gray-600">{new Date(purchase.createdAt).toLocaleString()}</Text>
          {purchase.supplierName ? (
            <Text className="mt-1 text-sm text-black">Supplier: {purchase.supplierName}</Text>
          ) : null}
          <View className="my-3 border-t-2 border-black" />
          {items.map((item) => (
            <View key={item.id} className="mb-2 flex-row justify-between">
              <Text className="flex-1 text-sm text-black">
                {item.productName} × {item.quantity}
              </Text>
              <Text className="text-sm font-bold text-black">
                {formatMoney(item.lineTotal, settings)}
              </Text>
            </View>
          ))}
          <View className="my-3 border-t-2 border-black" />
          <View className="flex-row justify-between">
            <Text className="text-black">Subtotal</Text>
            <Text className="font-bold text-black">{formatMoney(purchase.subtotal, settings)}</Text>
          </View>
          {purchase.taxAmount > 0 ? (
            <View className="flex-row justify-between">
              <Text className="text-black">Tax</Text>
              <Text className="font-bold text-black">{formatMoney(purchase.taxAmount, settings)}</Text>
            </View>
          ) : null}
          <View className="mt-2 flex-row justify-between">
            <Text className="text-lg font-bold text-black">Total</Text>
            <Text className="text-lg font-bold text-black">{formatMoney(purchase.total, settings)}</Text>
          </View>
          <Text className="mt-2 text-sm text-gray-600">
            Paid: {formatMoney(purchase.amountPaid, settings)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/(main)/purchases/history')}
          className="mt-4 border-2 border-black bg-app-primary py-3"
        >
          <Text className="text-center font-bold text-white">All Purchases</Text>
        </Pressable>
    </ScreenContainer>
  );
}
