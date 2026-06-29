import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ListCard } from '../../../src/components/ListCard';
import { ListToolbar } from '../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { usePaginatedList } from '../../../src/hooks/usePaginatedList';
import {
  listStockMovementsPaginated,
  type StockMovementFilters,
} from '../../../src/repositories/stockRepository';
import type { StockMovement } from '../../../src/types';
import { colors } from '../../../src/constants/theme';

const TYPE_FILTERS = [
  { key: 'sale', label: 'Sale' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'adjustment', label: 'Adjust' },
  { key: 'refund', label: 'Refund' },
  { key: 'return', label: 'Return' },
];

const TYPE_LABELS: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  refund: 'Refund',
  adjustment: 'Adjustment',
  return: 'Return',
};

function movementTone(type: string): 'info' | 'success' | 'warning' | 'danger' | 'default' {
  if (type === 'purchase' || type === 'return') return 'success';
  if (type === 'sale' || type === 'refund') return 'danger';
  if (type === 'adjustment') return 'warning';
  return 'default';
}

export default function StockMovementsScreen() {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filters = useMemo<StockMovementFilters>(
    () => ({ movementType: typeFilter ?? undefined }),
    [typeFilter],
  );

  const fetchPage = useCallback(
    (params: Parameters<typeof listStockMovementsPaginated>[0]) =>
      listStockMovementsPaginated(params),
    [],
  );

  const {
    items: movements,
    total,
    loading,
    loadingMore,
    refreshing,
    search,
    setSearch,
    loadMore,
    refresh,
    hasMore,
  } = usePaginatedList<StockMovement, StockMovementFilters>(fetchPage, { filters });

  return (
    <ScreenContainer>
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search product or notes…"
        filters={TYPE_FILTERS}
        activeFilter={typeFilter}
        onFilterChange={setTypeFilter}
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={movements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard>
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text className="font-bold text-app-text">{item.productName}</Text>
                <View className="mt-1 flex-row flex-wrap items-center gap-2">
                  <StatusBadge
                    label={TYPE_LABELS[item.movementType] ?? item.movementType}
                    tone={movementTone(item.movementType)}
                  />
                  <Text className="text-sm text-app-muted">
                    {item.qtyBefore} → {item.qtyAfter}
                  </Text>
                </View>
                <Text className="mt-1 text-xs text-app-muted">
                  {new Date(item.createdAt).toLocaleString()}
                  {item.notes ? ` · ${item.notes}` : ''}
                </Text>
              </View>
              <Text
                className="text-lg font-bold"
                style={{ color: item.quantityChange >= 0 ? colors.success : colors.danger }}
              >
                {item.quantityChange >= 0 ? '+' : ''}
                {item.quantityChange}
              </Text>
            </View>
          </ListCard>
        )}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No movements"
        emptyMessage="Stock changes will appear here."
      />
      </ScreenList>
    </ScreenContainer>
  );
}
