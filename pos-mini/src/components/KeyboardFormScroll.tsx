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
import { KEYBOARD_HEADER_OFFSET } from '../navigation/headerOptions';

type Props = {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  keyboardVerticalOffset?: number;
};

export function KeyboardFormScroll({
  children,
  edges = ['bottom'],
  style,
  contentContainerStyle,
  keyboardVerticalOffset,
}: Props) {
  const colors = useThemeColors();
  const offset =
    keyboardVerticalOffset ?? (Platform.OS === 'ios' ? KEYBOARD_HEADER_OFFSET : 0);

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
          contentContainerStyle={[{ paddingBottom: 40 }, contentContainerStyle]}
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
};

/** For screens with FlashList or custom layout (no outer ScrollView). */
export function KeyboardAvoidingScreen({
  children,
  style,
  keyboardVerticalOffset,
}: ScreenProps) {
  const colors = useThemeColors();
  const offset =
    keyboardVerticalOffset ?? (Platform.OS === 'ios' ? KEYBOARD_HEADER_OFFSET : 0);

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
