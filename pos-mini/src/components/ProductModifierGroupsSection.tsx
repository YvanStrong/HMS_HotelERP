import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  getProductModifierGroupIds,
  listModifierGroups,
  setProductModifierGroups,
} from '../repositories/modifierRepository';
import { colors } from '../constants/theme';

type Props = {
  productId: string;
};

export function ProductModifierGroupsSection({ productId }: Props) {
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof listModifierGroups>>>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [all, linked] = await Promise.all([listModifierGroups(), getProductModifierGroupIds(productId)]);
    setGroups(all);
    setSelected(linked);
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (groupId: string) => {
    const next = selected.includes(groupId)
      ? selected.filter((id) => id !== groupId)
      : [...selected, groupId];
    setSelected(next);
    await setProductModifierGroups(productId, next);
  };

  if (groups.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="mb-2 text-lg font-bold text-app-text">Modifier groups</Text>
      <View className="flex-row flex-wrap gap-2">
        {groups.map((g) => {
          const active = selected.includes(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => void toggle(g.id)}
              className="rounded-lg border px-3 py-2"
              style={{
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surface,
              }}
            >
              <Text className="text-app-text">{g.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
