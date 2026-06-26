import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function StockLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Stock' }} />
      <ThemedStack.Screen name="alerts" options={{ title: 'Low Stock Alerts' }} />
      <ThemedStack.Screen name="adjustments" options={{ title: 'Stock Adjustment' }} />
      <ThemedStack.Screen name="adjust" options={{ title: 'Stock Adjustment' }} />
      <ThemedStack.Screen name="movements" options={{ title: 'Stock Movements' }} />
      <ThemedStack.Screen name="[productId]" options={{ title: 'Product Stock' }} />
    </ThemedStack>
  );
}
