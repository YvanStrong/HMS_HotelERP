import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { StockBadge } from '../../../src/components/StockBadge';
import { getProductById } from '../../../src/repositories/productRepository';
import { getProductStock, listStockMovements } from '../../../src/repositories/stockRepository';
import type { Product, StockMovement } from '../../../src/types';

const TYPE_LABELS: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  refund: 'Refund',
  adjustment: 'Adjustment',
  return: 'Return',
};

export default function ProductStockScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!productId) return;
      void (async () => {
        const [p, qty, movs] = await Promise.all([
          getProductById(productId),
          getProductStock(productId),
          listStockMovements(productId, 30),
        ]);
        setProduct(p);
        setStockQty(qty);
        setMovements(movs);
      })();
    }, [productId]),
  );

  if (!product) {
    return (
      <ScreenContainer>
        <Text className="text-app-text">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
        <View className="mb-4 border-2 border-black bg-white p-4">
          <Text className="text-xl font-bold text-black">{product.name}</Text>
          {product.sku ? <Text className="text-sm text-gray-600">{product.sku}</Text> : null}
          <View className="mt-3">
            <StockBadge qty={stockQty} minStock={product.minStock} unit={product.unit} />
          </View>
          <Text className="mt-2 text-sm text-gray-600">Min stock: {product.minStock} {product.unit}</Text>
        </View>

        <Pressable
          onPress={() => router.push('/(main)/stock/adjustments')}
          className="mb-4 border-2 border-black bg-app-primary py-3"
        >
          <Text className="text-center font-bold text-white">Adjust Stock</Text>
        </Pressable>

        <Text className="mb-2 font-bold text-black">Recent Movements</Text>
        {movements.length === 0 ? (
          <Text className="text-gray-600">No movements yet.</Text>
        ) : (
          movements.map((m) => (
            <View key={m.id} className="mb-2 border-2 border-black bg-white p-3">
              <View className="flex-row justify-between">
                <Text className="font-bold text-black">
                  {TYPE_LABELS[m.movementType] ?? m.movementType}
                </Text>
                <Text
                  className="font-bold"
                  style={{ color: m.quantityChange >= 0 ? '#16a34a' : '#dc2626' }}
                >
                  {m.quantityChange >= 0 ? '+' : ''}{m.quantityChange}
                </Text>
              </View>
              <Text className="text-sm text-gray-600">
                {m.qtyBefore} → {m.qtyAfter}
              </Text>
              <Text className="text-xs text-gray-500">
                {new Date(m.createdAt).toLocaleString()}
                {m.notes ? ` · ${m.notes}` : ''}
              </Text>
            </View>
          ))
        )}
    </ScreenContainer>
  );
}
