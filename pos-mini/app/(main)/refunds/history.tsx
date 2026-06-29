import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListCard } from '../../../src/components/ListCard';
import { ListToolbar } from '../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { usePaginatedList } from '../../../src/hooks/usePaginatedList';
import { listRefundsPaginated } from '../../../src/repositories/refundRepository';
import type { Refund } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

export default function RefundHistoryScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);

  const fetchPage = useCallback(
    (params: Parameters<typeof listRefundsPaginated>[0]) => listRefundsPaginated(params),
    [],
  );

  const {
    items: refunds,
    total,
    loading,
    loadingMore,
    refreshing,
    search,
    setSearch,
    loadMore,
    refresh,
    hasMore,
  } = usePaginatedList<Refund>(fetchPage);

  return (
    <ScreenContainer>
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search refund or invoice…"
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={refunds}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard onPress={() => router.push(`/(main)/refunds/${item.id}`)}>
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text className="font-bold text-app-text">{item.refundNumber}</Text>
                <Text className="mt-0.5 text-sm text-app-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
                {item.saleInvoiceNumber ? (
                  <Text className="mt-1 text-sm text-app-text">Sale {item.saleInvoiceNumber}</Text>
                ) : null}
              </View>
              <Text className="font-bold text-app-text">
                {formatMoney(item.total, settings)}
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
        emptyTitle="No refunds"
        emptyMessage="Process your first refund."
      />
      </ScreenList>
    </ScreenContainer>
  );
}
