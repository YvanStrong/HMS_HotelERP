import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { getThemeColors } from '../constants/theme';

export function HomeHeaderButton() {
  const router = useRouter();
  const themeMode = useAppStore((s) => s.themeMode);
  const palette = getThemeColors(themeMode);

  return (
    <Pressable
      onPress={() => router.replace('/')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Home"
      className="mr-2 rounded-lg p-1.5"
    >
      <Ionicons name="home-outline" size={24} color={palette.primary} />
    </Pressable>
  );
}
