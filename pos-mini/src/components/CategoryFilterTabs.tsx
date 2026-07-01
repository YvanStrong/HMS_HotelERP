import { Pressable, ScrollView, Text } from 'react-native';
import type { Category } from '../types';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CategoryFilterTabs({ categories, selectedId, onSelect }: Props) {
  const colors = useThemeColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-2 max-h-10"
      contentContainerStyle={{ gap: 8, paddingRight: 8 }}
    >
      <Pressable
        onPress={() => onSelect(null)}
        className="rounded-lg border px-3 py-1.5"
        style={{
          borderColor: selectedId === null ? colors.primary : colors.border,
          backgroundColor: selectedId === null ? colors.primarySoft : colors.surface,
        }}
      >
        <Text className="text-sm font-semibold text-app-text">All</Text>
      </Pressable>
      {categories.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onSelect(c.id)}
          className="rounded-lg border px-3 py-1.5"
          style={{
            borderColor: selectedId === c.id ? colors.primary : colors.border,
            backgroundColor: selectedId === c.id ? colors.primarySoft : colors.surface,
          }}
        >
          <Text className="text-sm font-semibold text-app-text">{c.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
