import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cardStyle, colors } from '../constants/theme';

type Props = {
  label: string;
  href: Href;
  subtitle?: string;
};

export function HubLink({ label, href, subtitle }: Props) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={cardStyle}
      className="mb-3 flex-row items-center justify-between p-4 active:opacity-90"
    >
      <View className="min-w-0 flex-1 pr-3">
        <Text className="font-semibold text-app-text">{label}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-app-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}
