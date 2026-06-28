import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function RefundsLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Refunds' }} />
      <ThemedStack.Screen name="new" options={{ title: 'New Refund' }} />
      <ThemedStack.Screen name="history" options={{ title: 'Refund History' }} />
      <ThemedStack.Screen name="[refundId]" options={{ title: 'Refund Detail' }} />
    </ThemedStack>
  );
}
