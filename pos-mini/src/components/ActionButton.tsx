import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { usePrimaryButtonStyle, useThemeColors } from '../hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  className,
}: Props) {
  const colors = useThemeColors();
  const primaryButtonStyle = usePrimaryButtonStyle();
  const variants: Record<Variant, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: colors.textInverse },
    secondary: { bg: colors.surface, text: colors.text, border: colors.border },
    danger: { bg: colors.dangerSoft, text: colors.danger, border: colors.danger },
  };
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-xl py-3 ${className ?? ''}`}
      style={[
        variant === 'primary' ? primaryButtonStyle : undefined,
        {
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: disabled || loading ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text className="text-center font-semibold" style={{ color: v.text }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
