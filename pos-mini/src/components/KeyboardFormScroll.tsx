import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useTheme';
import { KEYBOARD_HEADER_OFFSET, SCREEN_HORIZONTAL_PADDING } from '../navigation/headerOptions';

type Props = {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  keyboardVerticalOffset?: number;
  /** Set false only when parent already applies horizontal inset. */
  padded?: boolean;
};

export function KeyboardFormScroll({
  children,
  edges = ['bottom'],
  style,
  contentContainerStyle,
  keyboardVerticalOffset,
  padded = true,
}: Props) {
  const colors = useThemeColors();
  const offset =
    keyboardVerticalOffset ?? (Platform.OS === 'ios' ? KEYBOARD_HEADER_OFFSET : 0);
  const horizontalPad = padded ? { paddingHorizontal: SCREEN_HORIZONTAL_PADDING } : undefined;

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      edges={edges}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={offset}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { paddingBottom: 40, paddingTop: 8 },
            horizontalPad,
            contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  padded?: boolean;
};

/** For screens with FlashList or custom layout (no outer ScrollView). */
export function KeyboardAvoidingScreen({
  children,
  style,
  keyboardVerticalOffset,
  padded = true,
}: ScreenProps) {
  const colors = useThemeColors();
  const offset =
    keyboardVerticalOffset ?? (Platform.OS === 'ios' ? KEYBOARD_HEADER_OFFSET : 0);

  return (
    <KeyboardAvoidingView
      style={[
        { flex: 1, backgroundColor: colors.background },
        padded ? { paddingHorizontal: SCREEN_HORIZONTAL_PADDING, paddingTop: 8 } : undefined,
        style,
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
