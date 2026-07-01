import { Text, View } from 'react-native';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  name: string;
  color?: string;
};

export function CategoryBadge({ name, color }: Props) {
  const colors = useThemeColors();
  const badgeColor = color ?? colors.primary;
  return (
    <View
      className="self-start rounded px-2 py-0.5"
      style={{
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: badgeColor,
      }}
    >
      <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
        {name}
      </Text>
    </View>
  );
}
