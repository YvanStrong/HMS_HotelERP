import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: ReactNode;
};

/** In-screen header with back — use when stack header is hidden. */
export function ScreenHeader({ title, subtitle, showBack, rightAction }: Props) {
  const router = useRouter();
  const colors = useThemeColors();
  const canBack = showBack ?? router.canGoBack();

  return (
    <View className="mb-3 flex-row items-center">
      {canBack ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="mr-2 rounded-lg p-1 active:opacity-70"
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-xl font-bold text-app-text">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-app-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction}
    </View>
  );
}
