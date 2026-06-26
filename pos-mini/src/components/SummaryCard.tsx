import { Text, View } from 'react-native';
import { cardStyle } from '../constants/theme';

type Props = {
  label: string;
  value: string;
  subtitle?: string;
};

export function SummaryCard({ label, value, subtitle }: Props) {
  return (
    <View className="min-w-[46%] flex-1" style={cardStyle}>
      <View className="p-4">
        <Text className="text-xs font-semibold uppercase tracking-wide text-app-muted">{label}</Text>
        <Text className="mt-1 text-xl font-bold text-app-text">{value}</Text>
        {subtitle ? <Text className="mt-0.5 text-xs text-app-muted">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
