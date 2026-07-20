import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function SettingsLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Settings' }} />
      <ThemedStack.Screen name="business" options={{ title: 'Business' }} />
      <ThemedStack.Screen name="alerts" options={{ title: 'Alerts' }} />
      <ThemedStack.Screen name="currency" options={{ title: 'Currency' }} />
      <ThemedStack.Screen name="pos" options={{ title: 'POS & Permissions' }} />
      <ThemedStack.Screen name="payment" options={{ title: 'Payment Methods' }} />
      <ThemedStack.Screen name="receipt" options={{ title: 'Receipt' }} />
      <ThemedStack.Screen name="security" options={{ title: 'PIN & Security' }} />
      <ThemedStack.Screen name="backup" options={{ title: 'Backup & Export' }} />
      <ThemedStack.Screen name="printer" options={{ title: 'Printer' }} />
      <ThemedStack.Screen name="staff" options={{ title: 'Staff' }} />
      <ThemedStack.Screen name="shift" options={{ title: 'Shift' }} />
      <ThemedStack.Screen name="discounts" options={{ title: 'Discount Rules' }} />
      <ThemedStack.Screen name="modifiers" options={{ title: 'Modifiers' }} />
      <ThemedStack.Screen name="import-csv" options={{ title: 'Import CSV' }} />
      <ThemedStack.Screen name="about" options={{ title: 'About' }} />
    </ThemedStack>
  );
}
