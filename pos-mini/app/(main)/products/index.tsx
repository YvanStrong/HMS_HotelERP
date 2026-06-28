import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ActionButton } from '../../../src/components/ActionButton';
import { ConfirmModal } from '../../../src/components/ConfirmModal';
import { ListToolbar } from '../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../src/components/ScreenContainer';
import { SwipeableProductRow } from '../../../src/components/SwipeableProductRow';
import { usePaginatedList } from '../../../src/hooks/usePaginatedList';
import {
  deleteProduct,
  listProductsPaginated,
  updateProduct,
  type ProductListFilters,
} from '../../../src/repositories/productRepository';
import type { Product } from '../../../src/types';
import { colors } from '../../../src/constants/theme';

export default function ProductsListScreen() {
  const router = useRouter();
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const filters: ProductListFilters = { activeOnly: true };

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
    reload,
  } = usePaginatedList<Product, ProductListFilters>(fetchPage, { filters });

  const savePrice = async () => {
    if (!priceEditId) return;
    const price = Number(priceInput);
    if (!price || price < 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid price' });
      return;
    }
    try {
      await updateProduct(priceEditId, { sellPrice: price });
      Toast.show({ type: 'success', text1: 'Price updated' });
      setPriceEditId(null);
      await reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Update failed' });
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateId) return;
    try {
      await deleteProduct(deactivateId);
      Toast.show({ type: 'success', text1: 'Product deactivated' });
      setDeactivateId(null);
      await reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  if (priceEditId) {
    return (
      <ScreenContainer>
        <Text className="mb-2 text-lg font-bold text-app-text">Edit sell price</Text>
        <TextInput
          value={priceInput}
          onChangeText={setPriceInput}
          keyboardType="decimal-pad"
          autoFocus
          className="mb-4 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
        />
        <Pressable onPress={() => void savePrice()} className="mb-2 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold text-white">Save</Text>
        </Pressable>
        <Pressable onPress={() => setPriceEditId(null)} className="rounded-xl border border-app-border py-3">
          <Text className="text-center font-semibold text-app-text">Cancel</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="mb-3 flex-row gap-2">
        <View className="flex-1">
          <ActionButton label="+ Add product" onPress={() => router.push('/(main)/products/new')} />
        </View>
        <Pressable
          onPress={() => router.push('/(main)/products/categories')}
          className="rounded-xl border border-app-border bg-app-surface px-4 justify-center"
        >
          <Text className="font-semibold text-app-text">Categories</Text>
        </Pressable>
      </View>

      <ListToolbar search={search} onSearchChange={setSearch} placeholder="Search products…" resultCount={total} />

      <ScreenList>
      <PaginatedFlashList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableProductRow
            product={item}
            onPress={() => router.push(`/(main)/products/${item.id}`)}
            onEditPrice={() => {
              setPriceEditId(item.id);
              setPriceInput(String(item.sellPrice));
            }}
            onDeactivate={() => setDeactivateId(item.id)}
          />
        )}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No products"
        emptyMessage="Add your first product."
      />
      </ScreenList>

      <ConfirmModal
        visible={Boolean(deactivateId)}
        title="Deactivate product?"
        message="It will be hidden from sales but kept in history."
        destructive
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setDeactivateId(null)}
      />
    </ScreenContainer>
  );
}
