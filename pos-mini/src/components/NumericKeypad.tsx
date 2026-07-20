import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCardStyle, usePrimaryButtonStyle, useThemeColors } from '../hooks/useTheme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  /** Mask digits (for PIN entry). */
  secure?: boolean;
  /** Allow eye icon to reveal masked digits. */
  allowReveal?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

function maskValue(value: string): string {
  if (!value) return '••••';
  return '•'.repeat(value.length);
}

export function NumericKeypad({
  value,
  onChange,
  onSubmit,
  maxLength = 12,
  secure = false,
  allowReveal = false,
}: Props) {
  const cardStyle = useCardStyle();
  const palette = useThemeColors();
  const primaryButtonStyle = usePrimaryButtonStyle();
  const [revealed, setRevealed] = useState(false);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    if (key === '.' && value.includes('.')) return;
    onChange(value + key);
  };

  const displayValue = secure && !revealed ? maskValue(value) : value || (secure ? '••••' : '0');
  const showReveal = secure && allowReveal;

  return (
    <View>
      <View className="mb-3 flex-row items-center p-4" style={cardStyle}>
        <Text className="flex-1 text-right text-2xl font-bold text-app-text">{displayValue}</Text>
        {showReveal ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide PIN' : 'Show PIN'}
            className="ml-2 rounded-lg p-2"
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={palette.primary} />
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row flex-wrap overflow-hidden rounded-xl border border-app-border">
        {KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => handleKey(key)}
            className="w-1/3 items-center justify-center border border-app-border bg-app-surface py-4 active:opacity-80"
            style={({ pressed }) => (pressed ? { backgroundColor: palette.primarySoft } : undefined)}
          >
            <Text className="text-xl font-bold text-app-text">{key}</Text>
          </Pressable>
        ))}
      </View>
      {onSubmit ? (
        <Pressable onPress={onSubmit} className="mt-3 rounded-xl py-3" style={primaryButtonStyle}>
          <Text className="text-center font-semibold text-white">Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
