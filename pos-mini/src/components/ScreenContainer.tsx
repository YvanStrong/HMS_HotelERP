import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { getThemeColors } from '../constants/theme';
import { useAppStore } from '../store/appStore';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Scroll when content may exceed screen height (hub menus, forms, reports). */
  scroll?: boolean;
};

export function ScreenContainer({ children, style, padded = true, scroll = false }: Props) {
  const themeMode = useAppStore((s) => s.themeMode);
  const palette = getThemeColors(themeMode);
  const pad = padded ? { paddingHorizontal: 16, paddingTop: 8 } : undefined;

  if (scroll) {
    return (
      <ScrollView
        style={[{ flex: 1, backgroundColor: palette.background }, style]}
        contentContainerStyle={[pad, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[{ flex: 1, minHeight: 0, backgroundColor: palette.background }, pad, style]}>
      {children}
    </View>
  );
}

/** Flex region for FlashList / PaginatedFlashList below fixed toolbars. */
export function ScreenList({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, minHeight: 0 }, style]}>{children}</View>;
}
