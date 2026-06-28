import { Text, View } from 'react-native';
import { colors } from '../constants/theme';

type Props = {
  name: string;
  color?: string;
};

export function CategoryBadge({ name, color = colors.primary }: Props) {
  return (
    <View
      className="self-start rounded px-2 py-0.5"
      style={{
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
        {name}
      </Text>
    </View>
  );
}
