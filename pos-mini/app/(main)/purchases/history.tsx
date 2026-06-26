import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListCard } from '../../../src/components/ListCard';
import { ListToolbar } from '../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { usePaginatedList } from '../../../src/hooks/usePaginatedList';
import {
  listPurchasesPaginated,
  type PurchaseListFilters,
} from '../../../src/repositories/purchaseRepository';
import type { Purchase } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

const STATUS_FILTERS = [
  { key: 'completed', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
];

function purchaseTone(status: string, balance: number): 'success' | 'warning' | 'default' {
  if (status === 'pending' || balance > 0) return 'warning';
  return 'success';
}

export default function PurchaseHistoryScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filters = useMemo<PurchaseListFilters>(
    () => ({ status: statusFilter ?? undefined }),
    [statusFilter],
  );

  const fetchPage = useCallback(
    (params: Parameters<typeof listPurchasesPaginated>[0]) => listPurchasesPaginated(params),
    [],
  );

  const {
    items: purchases,
    total,
    loading,
    loadingMore,
    refreshing,
    search,
    setSearch,
    loadMore,
    refresh,
    hasMore,
  } = usePaginatedList<Purchase, PurchaseListFilters>(fetchPage, { filters });

  const renderItem = ({ item }: { item: Purchase }) => {
    const balance = item.total - item.amountPaid;
    return (
      <ListCard onPress={() => router.push(`/(main)/purchases/${item.id}`)}>
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text className="font-bold text-app-text">{item.poNumber}</Text>
            <Text className="mt-0.5 text-sm text-app-muted">
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            {item.supplierName ? (
              <Text className="mt-1 text-sm text-app-text" numberOfLines={1}>
                {item.supplierName}
              </Text>
            ) : (
              <Text className="mt-1 text-sm text-app-muted">No supplier</Text>
            )}
          </View>
          <View className="items-end gap-1">
            <Text className="font-bold text-app-text">{formatMoney(item.total, settings)}</Text>
            <StatusBadge
              label={balance > 0 ? `Due ${formatMoney(balance, settings)}` : item.status}
              tone={purchaseTone(item.status, balance)}
            />
          </View>
        </View>
      </ListCard>
    );
  };

  return (
    <ScreenContainer>
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search PO or supplier…"
        filters={STATUS_FILTERS}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={purchases}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No purchases"
        emptyMessage="Record your first purchase order."
      />
      </ScreenList>
    </ScreenContainer>
  );
}
