import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useTheme';

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
};

type Props<T extends string = string> = {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
};

export function SelectField<T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: Props<T>) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-app-text">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3"
      >
        <Text className={`flex-1 text-base ${selected ? 'text-app-text' : 'text-app-muted'}`}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={() => setOpen(false)}>
          <Pressable
            className="max-h-[70%] rounded-t-2xl border-t border-app-border bg-app-surface"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="border-b border-app-border px-4 py-3">
              <Text className="text-lg font-bold text-app-text">{label}</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="border-b border-app-border px-4 py-3"
                    style={{
                      backgroundColor: isSelected ? colors.primarySoft : colors.surface,
                    }}
                  >
                    <Text className="font-semibold text-app-text">{option.label}</Text>
                    {option.description ? (
                      <Text className="mt-0.5 text-sm text-app-muted">{option.description}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
