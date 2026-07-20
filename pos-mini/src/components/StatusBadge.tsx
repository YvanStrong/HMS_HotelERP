import { Text, View } from 'react-native';
import { useThemeColors } from '../hooks/useTheme';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

type Props = {
  label: string;
  tone?: Tone;
};

export function StatusBadge({ label, tone = 'default' }: Props) {
  const palette = useThemeColors();
  const tones: Record<Tone, { bg: string; text: string }> = {
    default: { bg: palette.background, text: palette.text },
    success: { bg: palette.successSoft, text: palette.success },
    warning: { bg: palette.warning + '33', text: palette.warning },
    danger: { bg: palette.dangerSoft, text: palette.danger },
    info: { bg: palette.primarySoft, text: palette.primary },
  };
  const s = tones[tone];

  return (
    <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: s.bg }}>
      <Text className="text-xs font-semibold capitalize" style={{ color: s.text }}>
        {label}
      </Text>
    </View>
  );
}
