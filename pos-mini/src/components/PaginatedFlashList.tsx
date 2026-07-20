import { ActivityIndicator, RefreshControl, Text, View, StyleSheet, type ViewStyle } from 'react-native';
import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { useThemeColors } from '../hooks/useTheme';
import { EmptyState } from './EmptyState';

type Props<T> = Omit<FlashListProps<T>, 'onEndReached'> & {
  loading?: boolean;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
};

export function PaginatedFlashList<T>({
  loading,
  loadingMore,
  refreshing,
  onRefresh,
  onLoadMore,
  hasMore,
  emptyTitle = 'Nothing here',
  emptyMessage,
  data,
  ListHeaderComponent,
  style,
  ...rest
}: Props<T>) {
  const colors = useThemeColors();
  const isEmpty = !loading && (data?.length ?? 0) === 0;
  const listStyle: ViewStyle = StyleSheet.flatten([
    { flex: 1, minHeight: 0 },
    style,
  ]) ?? { flex: 1, minHeight: 0 };

  return (
    <FlashList
      {...rest}
      style={listStyle}
      data={data}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      onEndReached={() => {
        if (hasMore && !loadingMore && !loading) onLoadMore?.();
      }}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={
        isEmpty ? <EmptyState title={emptyTitle} message={emptyMessage} /> : null
      }
      ListFooterComponent={
        loadingMore ? (
          <View className="items-center py-4">
            <ActivityIndicator color={colors.primary} />
            <Text className="mt-2 text-sm text-app-muted">Loading more…</Text>
          </View>
        ) : hasMore && (data?.length ?? 0) > 0 ? (
          <View className="items-center py-3">
            <Text className="text-xs text-app-muted">Scroll for more</Text>
          </View>
        ) : null
      }
    />
  );
}
