import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function ReportingLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Reports' }} />
      <ThemedStack.Screen name="sales" options={{ title: 'Sales Report' }} />
      <ThemedStack.Screen name="purchases" options={{ title: 'Purchases Report' }} />
      <ThemedStack.Screen name="profit" options={{ title: 'Profit & Loss' }} />
      <ThemedStack.Screen name="refunds" options={{ title: 'Refunds Report' }} />
      <ThemedStack.Screen name="expenses" options={{ title: 'Expenses Report' }} />
      <ThemedStack.Screen name="stock-report" options={{ title: 'Stock Report' }} />
      <ThemedStack.Screen name="tax-report" options={{ title: 'Tax Report' }} />
      <ThemedStack.Screen name="export" options={{ title: 'Export Data' }} />
    </ThemedStack>
  );
}
