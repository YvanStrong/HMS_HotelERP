import { Pressable, Text, View } from 'react-native';
import { FormField } from './FormField';
import { UNIT_PRESETS, isPresetUnit } from '../constants/units';
import { colors } from '../constants/theme';

type Props = {
  value: string;
  onChange: (unit: string) => void;
};

export function UnitPicker({ value, onChange }: Props) {
  const showCustom = value.length > 0 && !isPresetUnit(value);

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-app-text">Unit of measure</Text>
      <View className="mb-2 flex-row flex-wrap gap-2">
        {UNIT_PRESETS.map((u) => (
          <Pressable
            key={u}
            onPress={() => onChange(u)}
            className="rounded-lg border px-3 py-2"
            style={{
              borderColor: value === u ? colors.primary : colors.border,
              backgroundColor: value === u ? colors.primarySoft : colors.surface,
            }}
          >
            <Text className="font-medium text-app-text">{u}</Text>
          </Pressable>
        ))}
      </View>
      <FormField
        label={showCustom ? 'Custom unit' : 'Or enter custom unit'}
        value={showCustom ? value : ''}
        onChangeText={onChange}
        placeholder="e.g. slice, portion…"
      />
    </View>
  );
}
