import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { ModifierGroup, SelectedModifier } from '../types';
import { colors, primaryButtonStyle } from '../constants/theme';
import { formatMoney } from '../utils/currency';
import { useAppStore } from '../store/appStore';

type Props = {
  visible: boolean;
  productName: string;
  groups: ModifierGroup[];
  onConfirm: (modifiers: SelectedModifier[], priceDelta: number) => void;
  onCancel: () => void;
};

export function ModifierPickerModal({ visible, productName, groups, onConfirm, onCancel }: Props) {
  const settings = useAppStore((s) => s.settings);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const priceDelta = useMemo(() => {
    let total = 0;
    for (const group of groups) {
      const ids = selected[group.id] ?? [];
      for (const optId of ids) {
        const opt = group.options?.find((o) => o.id === optId);
        if (opt) total += opt.priceDelta;
      }
    }
    return total;
  }, [groups, selected]);

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.includes(optionId);
      if (exists) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (group.maxSelect === 1) {
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.length >= group.maxSelect) {
        Toast.show({ type: 'error', text1: `Max ${group.maxSelect} for ${group.name}` });
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const handleConfirm = () => {
    for (const group of groups) {
      const count = (selected[group.id] ?? []).length;
      if (group.required && count < Math.max(1, group.minSelect)) {
        Toast.show({ type: 'error', text1: `${group.name} is required` });
        return;
      }
      if (count < group.minSelect) {
        Toast.show({ type: 'error', text1: `Select at least ${group.minSelect} for ${group.name}` });
        return;
      }
    }

    const modifiers: SelectedModifier[] = [];
    for (const group of groups) {
      for (const optId of selected[group.id] ?? []) {
        const opt = group.options?.find((o) => o.id === optId);
        if (opt) {
          modifiers.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: opt.priceDelta,
          });
        }
      }
    }
    onConfirm(modifiers, priceDelta);
    setSelected({});
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[80%] rounded-t-2xl border-t border-app-border bg-app-surface p-4">
          <Text className="mb-1 text-xl font-bold text-app-text">Modifiers</Text>
          <Text className="mb-4 text-app-muted">{productName}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.id} className="mb-4">
                <Text className="mb-2 font-semibold text-app-text">
                  {group.name}
                  {group.required ? ' *' : ''}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {group.options?.map((opt) => {
                    const active = (selected[group.id] ?? []).includes(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => toggleOption(group, opt.id)}
                        className="rounded-lg border px-3 py-2"
                        style={{
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primarySoft : colors.surface,
                        }}
                      >
                        <Text className="text-app-text">
                          {opt.name}
                          {opt.priceDelta ? ` (+${formatMoney(opt.priceDelta, settings)})` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          {priceDelta > 0 ? (
            <Text className="mb-2 text-sm text-app-muted">Extra: {formatMoney(priceDelta, settings)}</Text>
          ) : null}
          <Pressable onPress={handleConfirm} className="rounded-xl py-4" style={primaryButtonStyle}>
            <Text className="text-center text-lg font-semibold text-white">Add to cart</Text>
          </Pressable>
          <Pressable onPress={onCancel} className="mt-2 rounded-xl border border-app-border py-3">
            <Text className="text-center font-bold text-app-text">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
