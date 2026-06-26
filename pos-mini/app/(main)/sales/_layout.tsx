import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function SalesLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Sales' }} />
      <ThemedStack.Screen name="new" options={{ title: 'New Sale' }} />
      <ThemedStack.Screen name="[saleId]" options={{ title: 'Sale Receipt' }} />
    </ThemedStack>
  );
}
