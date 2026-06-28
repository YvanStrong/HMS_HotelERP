import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SearchBar } from './SearchBar';
import { colors, selectedChipStyle, unselectedChipStyle } from '../constants/theme';

export type FilterChip = {
  key: string;
  label: string;
};

type Props = {
  search: string;
  onSearchChange: (text: string) => void;
  placeholder?: string;
  filters?: FilterChip[];
  activeFilter?: string | null;
  onFilterChange?: (key: string | null) => void;
  trailing?: ReactNode;
  resultCount?: number;
};

export function ListToolbar({
  search,
  onSearchChange,
  placeholder = 'Search...',
  filters,
  activeFilter,
  onFilterChange,
  trailing,
  resultCount,
}: Props) {
  return (
    <View className="mb-2">
      <View className="flex-row items-start gap-2">
        <View className="min-w-0 flex-1">
          <SearchBar value={search} onChangeText={onSearchChange} placeholder={placeholder} />
        </View>
        {trailing}
      </View>

      {filters && filters.length > 0 && onFilterChange ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          <Pressable
            onPress={() => onFilterChange(null)}
            className="rounded-lg border px-3 py-1.5"
            style={activeFilter == null ? selectedChipStyle : unselectedChipStyle}
          >
            <Text className="text-sm font-semibold text-app-text">All</Text>
          </Pressable>
          {filters.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => onFilterChange(f.key)}
              className="rounded-lg border px-3 py-1.5"
              style={activeFilter === f.key ? selectedChipStyle : unselectedChipStyle}
            >
              <Text className="text-sm font-semibold text-app-text">{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {resultCount !== undefined ? (
        <Text className="mb-1 text-xs text-app-muted">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </Text>
      ) : null}
    </View>
  );
}
