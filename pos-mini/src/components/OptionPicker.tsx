import { Pressable, Text, View } from 'react-native';
import { colors } from '../constants/theme';

type Option = {
  value: string;
  label: string;
};

type Props = {
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
};

export function OptionPicker({ label, options, value, onChange }: Props) {
  return (
    <>
      <Text className="mb-2 text-sm font-semibold text-app-text">{label}</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              className="rounded-lg border px-3 py-2"
              style={{
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primarySoft : colors.surface,
              }}
            >
              <Text className="font-medium text-app-text">{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
