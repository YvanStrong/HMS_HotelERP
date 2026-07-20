import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { getThemeColors } from '../constants/theme';
import { useGoBack } from '../navigation/useGoBack';

export function BackHeaderButton() {
  const themeMode = useAppStore((s) => s.themeMode);
  const palette = getThemeColors(themeMode);
  const { goBack, canShowBack } = useGoBack();

  if (!canShowBack) return null;

  return (
    <Pressable
      onPress={goBack}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Back"
      className="ml-1 flex-row items-center rounded-lg py-1 pr-2"
    >
      <Ionicons name="chevron-back" size={24} color={palette.primary} />
      <Text style={{ color: palette.primary }} className="text-base font-semibold">
        Back
      </Text>
    </Pressable>
  );
}
