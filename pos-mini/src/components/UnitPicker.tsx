import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from './FormField';
import { UNIT_PRESETS, isPresetUnit } from '../constants/units';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  value: string;
  onChange: (unit: string) => void;
};

export function UnitPicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const showCustom = value.length > 0 && !isPresetUnit(value);

  const displayLabel = useMemo(() => {
    if (!value) return 'Select unit…';
    if (isPresetUnit(value)) return value;
    return value;
  }, [value]);

  const pickUnit = (unit: string) => {
    onChange(unit);
    setCustomMode(false);
    setOpen(false);
  };

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-app-text">Unit of measure</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3"
      >
        <Text className={`text-base ${value ? 'text-app-text' : 'text-app-muted'}`}>{displayLabel}</Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setOpen(false)}>
          <Pressable
            className="max-h-[70%] rounded-t-2xl border-t border-app-border bg-app-surface"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between border-b border-app-border px-4 py-3">
              <Text className="text-lg font-bold text-app-text">Unit of measure</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text className="font-semibold text-app-primary">Done</Text>
              </Pressable>
            </View>

            {customMode ? (
              <View className="p-4">
                <FormField
                  label="Custom unit"
                  value={showCustom ? value : ''}
                  onChangeText={onChange}
                  placeholder="e.g. slice, portion…"
                  autoFocus
                />
                <Pressable
                  onPress={() => {
                    if (value.trim()) setOpen(false);
                  }}
                  className="mt-2 rounded-xl py-3"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-center font-semibold text-white">Use this unit</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCustomMode(false)}
                  className="mt-2 rounded-xl border border-app-border py-3"
                >
                  <Text className="text-center font-semibold text-app-text">Back to list</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
                {UNIT_PRESETS.map((u) => {
                  const isSelected = value === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => pickUnit(u)}
                      className="flex-row items-center justify-between border-b border-app-border px-4 py-3"
                      style={{ backgroundColor: isSelected ? colors.primarySoft : colors.surface }}
                    >
                      <Text className="font-medium text-app-text">{u}</Text>
                      {isSelected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setCustomMode(true)}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <Text className="font-medium text-app-primary">Custom unit…</Text>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
