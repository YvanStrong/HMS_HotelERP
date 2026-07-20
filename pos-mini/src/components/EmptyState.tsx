import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
};

export function EmptyState({ icon = 'file-tray-outline', title, message }: Props) {
  const palette = useThemeColors();

  return (
    <View className="items-center justify-center py-12">
      <Ionicons name={icon} size={48} color={palette.textMuted} />
      <Text className="mt-3 text-lg font-bold text-app-text">{title}</Text>
      {message ? <Text className="mt-1 text-center text-app-muted">{message}</Text> : null}
    </View>
  );
}
