import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, getThemeColors } from '../constants/theme';
import type { ThemeMode } from '../types';

export function getStackScreenOptions(mode: ThemeMode = 'light'): NativeStackNavigationOptions {
  const palette = getThemeColors(mode);
  return {
    headerShown: true,
    headerBackVisible: true,
    headerStyle: { backgroundColor: palette.surface },
    headerTintColor: palette.primary,
    headerTitleStyle: { fontWeight: '600', color: palette.text },
    headerShadowVisible: false,
    headerBackTitle: 'Back',
    contentStyle: { flex: 1, backgroundColor: palette.background },
  };
}

/** @deprecated Use getStackScreenOptions(themeMode) or ThemedStack */
export const stackScreenOptions: NativeStackNavigationOptions = getStackScreenOptions('light');

/** Offset below stack header when avoiding keyboard (iOS). */
export const KEYBOARD_HEADER_OFFSET = 88;
