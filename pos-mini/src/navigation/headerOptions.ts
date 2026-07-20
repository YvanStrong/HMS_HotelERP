import { createElement } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { BackHeaderButton } from '../components/BackHeaderButton';
import { HomeHeaderButton } from '../components/HomeHeaderButton';
import { getThemeColors } from '../constants/theme';
import type { ThemeMode } from '../types';

export function getStackScreenOptions(mode: ThemeMode = 'light'): NativeStackNavigationOptions {
  const palette = getThemeColors(mode);
  return {
    headerShown: true,
    headerBackVisible: false,
    headerLeft: () => createElement(BackHeaderButton),
    headerStyle: { backgroundColor: palette.surface },
    headerTintColor: palette.primary,
    headerTitleStyle: { fontWeight: '600', color: palette.text },
    headerShadowVisible: false,
    headerRight: () => createElement(HomeHeaderButton),
    contentStyle: { flex: 1, backgroundColor: palette.background },
  };
}

/** @deprecated Use getStackScreenOptions(themeMode) or ThemedStack */
export const stackScreenOptions: NativeStackNavigationOptions = getStackScreenOptions('light');

/** Offset below stack header when avoiding keyboard (iOS). */
export const KEYBOARD_HEADER_OFFSET = 88;

/** Standard horizontal inset for screen content (16px). */
export const SCREEN_HORIZONTAL_PADDING = 16;
