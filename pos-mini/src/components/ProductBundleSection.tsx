import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { SearchBar } from './SearchBar';
import {
  addBundleItem,
  listBundleItems,
  removeBundleItem,
  updateBundleItemQuantity,
} from '../repositories/bundleRepository';
import { listProducts, searchProducts } from '../repositories/productRepository';
import type { Product, ProductBundleItem } from '../types';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  productId: string;
};

export function ProductBundleSection({ productId }: Props) {
  const colors = useThemeColors();
  const [items, setItems] = useState<ProductBundleItem[]>([]);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    setItems(await listBundleItems(productId));
  }, [productId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!showPicker) return;
      void (query ? searchProducts(query) : listProducts()).then((list) =>
        setProducts(list.filter((p) => p.id !== productId)),
      );
    }, [showPicker, query, productId]),
  );

  const addChild = async (product: Product) => {
    try {
      await addBundleItem(productId, product.id, 1);
      setShowPicker(false);
      setQuery('');
      await load();
      Toast.show({ type: 'success', text1: 'Bundle item added' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  return (
    <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
      <Text className="mb-1 font-bold text-app-text">Bundle / combo items</Text>
      <Text className="mb-3 text-xs text-app-muted">
        Sold as one line at this product&apos;s price. Child stock is deducted on sale (not the parent SKU).
      </Text>

      {items.length === 0 ? (
        <Text className="mb-3 text-sm text-app-muted">No bundle components yet.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} className="mb-2 flex-row items-center justify-between rounded-lg border border-app-border p-2">
            <Text className="flex-1 text-app-text">{item.childProductName ?? item.childProductId}</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() =>
                  void updateBundleItemQuantity(item.id, Math.max(1, item.quantity - 1)).then(load)
                }
                className="rounded border border-app-border px-2 py-1"
              >
                <Text className="font-bold text-app-text">−</Text>
              </Pressable>
              <Text className="min-w-[24px] text-center font-semibold text-app-text">{item.quantity}</Text>
              <Pressable
                onPress={() => void updateBundleItemQuantity(item.id, item.quantity + 1).then(load)}
                className="rounded border border-app-border px-2 py-1"
              >
                <Text className="font-bold text-app-text">+</Text>
              </Pressable>
              <Pressable onPress={() => void removeBundleItem(item.id).then(load)}>
                <Text className="text-sm font-semibold text-app-danger">Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {!showPicker ? (
        <Pressable
          onPress={() => setShowPicker(true)}
          className="rounded-lg py-2"
          style={{ backgroundColor: colors.primarySoft }}
        >
          <Text className="text-center font-semibold text-app-primary">Add component product</Text>
        </Pressable>
      ) : (
        <View>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search products…" />
          {products.slice(0, 8).map((p) => (
            <Pressable key={p.id} onPress={() => void addChild(p)} className="mb-1 rounded-lg border border-app-border p-2">
              <Text className="font-medium text-app-text">{p.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowPicker(false)} className="mt-2">
            <Text className="text-center text-sm text-app-muted">Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
