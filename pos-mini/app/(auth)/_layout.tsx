import { Stack } from 'expo-router';
import { useAndroidBackHandler } from '../../src/hooks/useAndroidBackHandler';

export default function AuthLayout() {
  useAndroidBackHandler();

  return <Stack screenOptions={{ headerShown: false }} />;
}
