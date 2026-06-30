import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton } from '../../../src/components/ActionButton';
import { ListCard } from '../../../src/components/ListCard';
import { ListToolbar } from '../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { usePaginatedList } from '../../../src/hooks/usePaginatedList';
import { listSalesPaginated, type SaleListFilters } from '../../../src/repositories/saleRepository';
import type { Sale } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

const PAYMENT_FILTERS = [
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'credit', label: 'Credit' },
];

export default function SalesListScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);

  const filters = useMemo<SaleListFilters>(
    () => ({ paymentMethod: paymentFilter ?? undefined }),
    [paymentFilter],
  );

  const fetchPage = useCallback(
    (params: Parameters<typeof listSalesPaginated>[0]) => listSalesPaginated(params),
    [],
  );

  const {
    items: sales,
    total,
    loading,
    loadingMore,
    refreshing,
    search,
    setSearch,
    loadMore,
    refresh,
    hasMore,
  } = usePaginatedList<Sale, SaleListFilters>(fetchPage, { filters });

  const renderItem = ({ item }: { item: Sale }) => (
    <ListCard onPress={() => router.push(`/(main)/sales/${item.id}`)}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-app-text">{item.invoiceNumber}</Text>
          <Text className="mt-0.5 text-sm text-app-muted">
            {new Date(item.createdAt).toLocaleString()}
          </Text>
          {item.customerName ? (
            <Text className="mt-1 text-sm text-app-text" numberOfLines={1}>
              {item.customerName}
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-1">
          <Text className="font-bold text-app-text">{formatMoney(item.total, settings)}</Text>
          <StatusBadge label={item.paymentMethod} tone="info" />
          {item.status === 'voided' ? <StatusBadge label="Voided" tone="danger" /> : null}
        </View>
      </View>
    </ListCard>
  );

  return (
    <ScreenContainer>
      <ActionButton
        label="+ New Sale"
        onPress={() => router.push('/(main)/sales/new')}
        className="mb-2"
      />
      <ActionButton
        label="Kitchen tickets"
        onPress={() => router.push('/(main)/sales/kitchen')}
        variant="secondary"
        className="mb-3"
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search invoice or customer…"
        filters={PAYMENT_FILTERS}
        activeFilter={paymentFilter}
        onFilterChange={setPaymentFilter}
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={sales}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No sales yet"
        emptyMessage="Create your first sale to get started."
      />
      </ScreenList>
    </ScreenContainer>
  );
}
