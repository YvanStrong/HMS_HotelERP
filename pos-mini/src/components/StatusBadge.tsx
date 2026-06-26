import { Text, View } from 'react-native';
import { colors } from '../constants/theme';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<Tone, { bg: string; text: string }> = {
  default: { bg: colors.background, text: colors.text },
  success: { bg: colors.successSoft, text: colors.success },
  warning: { bg: '#fef9c3', text: colors.warning },
  danger: { bg: colors.dangerSoft, text: colors.danger },
  info: { bg: colors.primarySoft, text: colors.primary },
};

type Props = {
  label: string;
  tone?: Tone;
};

export function StatusBadge({ label, tone = 'default' }: Props) {
  const s = TONE_STYLES[tone];
  return (
    <View
      className="rounded-md px-2 py-0.5"
      style={{ backgroundColor: s.bg }}
    >
      <Text className="text-xs font-semibold capitalize" style={{ color: s.text }}>
        {label}
      </Text>
    </View>
  );
}
