import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function PurchasesLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Purchases' }} />
      <ThemedStack.Screen name="new" options={{ title: 'New Purchase' }} />
      <ThemedStack.Screen name="history" options={{ title: 'Purchase History' }} />
      <ThemedStack.Screen name="[purchaseId]" options={{ title: 'Purchase Detail' }} />
    </ThemedStack>
  );
}
