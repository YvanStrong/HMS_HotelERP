import { Pressable, Text, View } from 'react-native';
import { useCardStyle, usePrimaryButtonStyle, useThemeColors } from '../hooks/useTheme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function NumericKeypad({ value, onChange, onSubmit, maxLength = 12 }: Props) {
  const cardStyle = useCardStyle();
  const palette = useThemeColors();
  const primaryButtonStyle = usePrimaryButtonStyle();

  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    if (key === '.' && value.includes('.')) return;
    onChange(value + key);
  };

  return (
    <View>
      <View className="mb-3 p-4" style={cardStyle}>
        <Text className="text-right text-2xl font-bold text-app-text">{value || '0'}</Text>
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
