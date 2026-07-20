import { ThemedStack } from '../../src/navigation/ThemedStack';
import { useAndroidBackHandler } from '../../src/hooks/useAndroidBackHandler';

export default function AuthLayout() {
  useAndroidBackHandler();

  return (
    <ThemedStack>
      <ThemedStack.Screen name="setup" options={{ title: 'Setup' }} />
      <ThemedStack.Screen name="staff" options={{ title: 'Staff sign in' }} />
      <ThemedStack.Screen name="pin" options={{ title: 'Unlock' }} />
    </ThemedStack>
  );
}
