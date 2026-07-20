import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListCard } from '../../../src/components/ListCard';
import { PaginatedFlashList } from '../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { StockBadge } from '../../../src/components/StockBadge';
import { usePaginatedList } from '../../../src/hooks/usePaginatedList';
import {
  listProductsPaginated,
  type ProductListFilters,
} from '../../../src/repositories/productRepository';
import type { Product } from '../../../src/types';
import { useThemeColors } from '../../../src/hooks/useTheme';

const filters: ProductListFilters = { activeOnly: true, trackStockOnly: true, lowStockOnly: true };

export default function StockAlertsScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  const fetchPage = useCallback(
    (params: Parameters<typeof listProductsPaginated>[0]) => listProductsPaginated(params),
    [],
  );
  const { items, total, loading, loadingMore, refreshing, loadMore, refresh, hasMore } =
    usePaginatedList<Product, ProductListFilters>(fetchPage, { filters });

  const reorderSuggestions = useMemo(
    () =>
      items
        .map((p) => ({ p, need: Math.max(0, p.minStock - p.stockQty) }))
        .filter((x) => x.need > 0)
        .sort((a, b) => b.need - a.need)
        .slice(0, 5),
    [items],
  );

  const renderItem = ({ item }: { item: Product }) => (
    <ListCard onPress={() => router.push(`/(main)/stock/${item.id}`)}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-app-text" numberOfLines={2}>
            {item.name}
          </Text>
          <Text className="mt-1 text-sm text-app-muted">
            Min {item.minStock} {item.unit}
          </Text>
          <StockBadge qty={item.stockQty} minStock={item.minStock} unit={item.unit} />
        </View>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(main)/purchases/new',
              params: { productId: item.id },
            })
          }
          className="rounded-lg px-3 py-2"
          style={{ backgroundColor: colors.warning }}
        >
          <Text className="text-xs font-semibold text-white">Order now</Text>
        </Pressable>
      </View>
    </ListCard>
  );

  return (
    <ScreenContainer>
      {reorderSuggestions.length > 0 ? (
        <View className="mb-3 rounded-xl border border-app-border bg-app-surface p-3">
          <Text className="mb-2 font-bold text-app-text">Reorder suggestions</Text>
          {reorderSuggestions.map(({ p, need }) => (
            <View key={p.id} className="mb-1 flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-app-text" numberOfLines={1}>
                {p.name} — order ~{need} {p.unit}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/(main)/purchases/new', params: { productId: p.id } })
                }
                className="rounded px-2 py-1"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-xs font-semibold text-white">PO</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Text className="mb-3 text-sm text-app-muted">
        {total} product{total === 1 ? '' : 's'} below minimum stock
      </Text>
      <ScreenList>
      <PaginatedFlashList
        data={items}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No low stock alerts"
        emptyMessage="All tracked products are above minimum levels"
      />
      </ScreenList>
    </ScreenContainer>
  );
}
