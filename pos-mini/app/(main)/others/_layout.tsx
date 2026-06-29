import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function OthersLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Others' }} />
      <ThemedStack.Screen name="customers/index" options={{ title: 'Customers' }} />
      <ThemedStack.Screen name="customers/[customerId]" options={{ title: 'Customer' }} />
      <ThemedStack.Screen name="suppliers/index" options={{ title: 'Suppliers' }} />
      <ThemedStack.Screen name="suppliers/[supplierId]" options={{ title: 'Supplier' }} />
      <ThemedStack.Screen name="expenses/index" options={{ title: 'Expenses' }} />
      <ThemedStack.Screen name="debts/index" options={{ title: 'Debts' }} />
    </ThemedStack>
  );
}
