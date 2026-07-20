import { ThemedStack } from '../../src/navigation/ThemedStack';
import { useAndroidBackHandler } from '../../src/hooks/useAndroidBackHandler';

export default function MainLayout() {
  useAndroidBackHandler();

  return (
    <ThemedStack>
      <ThemedStack.Screen name="sales" options={{ headerShown: false }} />
      <ThemedStack.Screen name="products" options={{ headerShown: false }} />
      <ThemedStack.Screen name="purchases" options={{ headerShown: false }} />
      <ThemedStack.Screen name="refunds" options={{ headerShown: false }} />
      <ThemedStack.Screen name="stock" options={{ headerShown: false }} />
      <ThemedStack.Screen name="settings" options={{ headerShown: false }} />
      <ThemedStack.Screen name="others" options={{ headerShown: false }} />
      <ThemedStack.Screen name="reporting" options={{ headerShown: false }} />
    </ThemedStack>
  );
}
