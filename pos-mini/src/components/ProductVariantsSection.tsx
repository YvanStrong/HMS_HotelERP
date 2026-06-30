import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import {
  createVariant,
  deleteVariant,
  listVariantsByProduct,
} from '../repositories/variantRepository';
import type { ProductVariant } from '../types';
import { colors } from '../constants/theme';
import { formatMoney } from '../utils/currency';
import { useAppStore } from '../store/appStore';

type Props = {
  productId: string;
};

export function ProductVariantsSection({ productId }: Props) {
  const settings = useAppStore((s) => s.settings);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [name, setName] = useState('');
  const [sellPrice, setSellPrice] = useState('0');
  const [stockQty, setStockQty] = useState('0');

  const load = useCallback(async () => {
    setVariants(await listVariantsByProduct(productId, false));
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Variant name required' });
      return;
    }
    await createVariant({
      productId,
      name: name.trim(),
      sku: null,
      barcode: null,
      sellPrice: Number(sellPrice) || 0,
      costPrice: 0,
      stockQty: Number(stockQty) || 0,
      isActive: true,
    });
    setName('');
    setSellPrice('0');
    setStockQty('0');
    await load();
    Toast.show({ type: 'success', text1: 'Variant added' });
  };

  return (
    <View className="mb-4">
      <Text className="mb-2 text-lg font-bold text-app-text">Variants</Text>
      {variants.filter((v) => v.isActive).map((v) => (
        <View key={v.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface p-3">
          <View>
            <Text className="font-semibold text-app-text">{v.name}</Text>
            <Text className="text-sm text-app-muted">
              {formatMoney(v.sellPrice, settings)} · Stock {v.stockQty}
            </Text>
          </View>
          <Pressable onPress={() => void deleteVariant(v.id).then(load)}>
            <Text className="text-sm text-app-danger">Remove</Text>
          </Pressable>
        </View>
      ))}
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Variant name (e.g. Large)"
        className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
      />
      <View className="mb-2 flex-row gap-2">
        <TextInput
          value={sellPrice}
          onChangeText={setSellPrice}
          placeholder="Price"
          keyboardType="decimal-pad"
          className="flex-1 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
        />
        <TextInput
          value={stockQty}
          onChangeText={setStockQty}
          placeholder="Stock"
          keyboardType="decimal-pad"
          className="flex-1 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
        />
      </View>
      <Pressable onPress={() => void add()} className="rounded-xl py-3" style={{ backgroundColor: colors.primarySoft }}>
        <Text className="text-center font-semibold text-app-primary">Add variant</Text>
      </Pressable>
    </View>
  );
}
