import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { SearchBar } from '../../../src/components/SearchBar';
import { StockBadge } from '../../../src/components/StockBadge';
import { listProducts, searchProducts } from '../../../src/repositories/productRepository';
import { adjustStock } from '../../../src/repositories/stockRepository';
import type { Product } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';

export default function StockAdjustmentsScreen() {
  const refreshStats = useAppStore((s) => s.refreshStats);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [qtyChange, setQtyChange] = useState('');
  const [reason, setReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const list = query ? await searchProducts(query) : await listProducts();
        setProducts(list.filter((p) => p.trackStock));
      })();
    }, [query]),
  );

  const applyAdjustment = async () => {
    if (!selected) {
      Toast.show({ type: 'error', text1: 'Select a product' });
      return;
    }
    const change = Number(qtyChange);
    if (!change || change === 0) {
      Toast.show({ type: 'error', text1: 'Enter a non-zero quantity' });
      return;
    }

    try {
      await adjustStock({
        productId: selected.id,
        quantityChange: change,
        notes: reason || null,
      });
      await refreshStats();
      Toast.show({ type: 'success', text1: 'Stock adjusted' });
      setSelected(null);
      setQtyChange('');
      setReason('');
      const list = query ? await searchProducts(query) : await listProducts();
      setProducts(list.filter((p) => p.trackStock));
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Adjustment failed' });
    }
  };

  return (
    <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search products..." />

        {selected ? (
          <View className="mb-4 border-2 border-black bg-white p-4">
            <Text className="font-bold text-black">{selected.name}</Text>
            <View className="mt-2">
              <StockBadge qty={selected.stockQty} minStock={selected.minStock} unit={selected.unit} />
            </View>
            <Text className="mt-3 font-bold text-black">Quantity change (+/-)</Text>
            <TextInput
              value={qtyChange}
              onChangeText={setQtyChange}
              placeholder="e.g. 5 or -3"
              keyboardType="numbers-and-punctuation"
              className="mt-1 border-2 border-black bg-white px-3 py-3 text-black"
            />
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
              className="mt-2 border-2 border-black bg-white px-3 py-3 text-black"
            />
            <View className="mt-3 flex-row gap-2">
              <Pressable onPress={() => setSelected(null)} className="flex-1 border-2 border-black py-3">
                <Text className="text-center font-bold text-black">Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void applyAdjustment()} className="flex-1 border-2 border-black bg-app-primary py-3">
                <Text className="text-center font-bold text-white">Apply</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          products.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSelected(p)}
              className="mb-2 border-2 border-black bg-white p-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-black">{p.name}</Text>
                <StockBadge qty={p.stockQty} minStock={p.minStock} unit={p.unit} />
              </View>
            </Pressable>
          ))
        )}
      </KeyboardFormScroll>
  );
}
