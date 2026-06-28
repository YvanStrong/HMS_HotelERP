import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListCard } from '../../../src/components/ListCard';
import { ListToolbar } from '../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { StockBadge } from '../../../src/components/StockBadge';
import { usePaginatedList } from '../../../src/hooks/usePaginatedList';
import {
  listProductsPaginated,
  type ProductListFilters,
} from '../../../src/repositories/productRepository';
import type { Product } from '../../../src/types';
import { colors } from '../../../src/constants/theme';

export default function StockListScreen() {
  const router = useRouter();
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const filters = useMemo<ProductListFilters>(
    () => ({ activeOnly: true, trackStockOnly: true, lowStockOnly }),
    [lowStockOnly],
  );

  const fetchPage = useCallback(
    (params: Parameters<typeof listProductsPaginated>[0]) => listProductsPaginated(params),
    [],
  );

  const {
    items: products,
    total,
    loading,
    loadingMore,
    refreshing,
    search,
    setSearch,
    loadMore,
    refresh,
    hasMore,
  } = usePaginatedList<Product, ProductListFilters>(fetchPage, { filters });

  const stockFilters = [
    { key: 'low', label: 'Low stock' },
  ];

  return (
    <ScreenContainer>
      <View className="mb-3 flex-row gap-2">
        <Pressable
          onPress={() => router.push('/(main)/stock/alerts')}
          className="flex-1 rounded-xl py-2.5"
          style={{ backgroundColor: colors.warning }}
        >
          <Text className="text-center text-sm font-semibold text-white">Alerts</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(main)/stock/adjustments')}
          className="flex-1 rounded-xl py-2.5"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-center text-sm font-semibold text-white">Adjust</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(main)/stock/movements')}
          className="flex-1 rounded-xl border border-app-border bg-app-surface py-2.5"
        >
          <Text className="text-center text-sm font-semibold text-app-text">History</Text>
        </Pressable>
      </View>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search stock items…"
        filters={stockFilters}
        activeFilter={lowStockOnly ? 'low' : null}
        onFilterChange={(key) => setLowStockOnly(key === 'low')}
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isLow = item.stockQty <= item.minStock;
          return (
            <ListCard
              highlight={isLow}
              onPress={() => router.push(`/(main)/stock/${item.id}`)}
            >
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1 pr-2">
                  <Text className="font-bold text-app-text">{item.name}</Text>
                  {item.sku ? <Text className="text-xs text-app-muted">{item.sku}</Text> : null}
                  {isLow ? (
                    <Text className="mt-1 text-xs font-semibold text-app-warning">Low stock</Text>
                  ) : null}
                </View>
                <StockBadge qty={item.stockQty} minStock={item.minStock} unit={item.unit} />
              </View>
            </ListCard>
          );
        }}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No tracked products"
        emptyMessage="Enable stock tracking on products."
      />
      </ScreenList>
    </ScreenContainer>
  );
}
