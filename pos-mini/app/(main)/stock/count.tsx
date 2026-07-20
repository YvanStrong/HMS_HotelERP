import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SearchBar } from '../../../src/components/SearchBar';
import { listProducts } from '../../../src/repositories/productRepository';
import { adjustStock } from '../../../src/repositories/stockRepository';
import type { Product } from '../../../src/types';
import { useThemeColors } from '../../../src/hooks/useTheme';

type CountLine = {
  productId: string;
  productName: string;
  unit: string;
  systemQty: number;
  countedQty: string;
};

export default function StockCountScreen() {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<CountLine[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const products = await listProducts(true);
    const tracked = products.filter((p) => p.trackStock);
    setLines(
      tracked.map((p) => ({
        productId: p.id,
        productName: p.name,
        unit: p.unit,
        systemQty: p.stockQty,
        countedQty: String(p.stockQty),
      })),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => l.productName.toLowerCase().includes(q));
  }, [lines, query]);

  const variances = useMemo(
    () =>
      lines
        .map((l) => {
          const counted = Number(l.countedQty);
          if (!Number.isFinite(counted)) return null;
          const diff = counted - l.systemQty;
          if (diff === 0) return null;
          return { ...l, counted, diff };
        })
        .filter((v): v is CountLine & { counted: number; diff: number } => v !== null),
    [lines],
  );

  const updateCount = (productId: string, value: string) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, countedQty: value } : l)));
  };

  const applyVariances = async () => {
    if (variances.length === 0) {
      Toast.show({ type: 'info', text1: 'No variances to post' });
      return;
    }
    setSaving(true);
    try {
      for (const v of variances) {
        await adjustStock({
          productId: v.productId,
          quantityChange: v.diff,
          notes: `Cycle count: system ${v.systemQty} → counted ${v.counted}`,
        });
      }
      Toast.show({ type: 'success', text1: `${variances.length} adjustment(s) saved` });
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Text className="mb-2 text-sm text-app-muted">
        Enter physical counts. Variances are posted as stock adjustments with a cycle-count note.
      </Text>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search products…" />

      {variances.length > 0 ? (
        <View className="mb-4 rounded-xl border border-app-warning bg-app-surface p-3">
          <Text className="mb-2 font-bold text-app-text">Variance report ({variances.length})</Text>
          {variances.slice(0, 8).map((v) => (
            <Text key={v.productId} className="text-sm text-app-text">
              {v.productName}: {v.systemQty} → {v.counted} ({v.diff > 0 ? '+' : ''}
              {v.diff} {v.unit})
            </Text>
          ))}
          {variances.length > 8 ? (
            <Text className="mt-1 text-xs text-app-muted">+{variances.length - 8} more</Text>
          ) : null}
        </View>
      ) : null}

      {filtered.map((line) => (
        <View key={line.productId} className="mb-2 flex-row items-center gap-2 rounded-xl border border-app-border bg-app-surface p-3">
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-app-text" numberOfLines={1}>
              {line.productName}
            </Text>
            <Text className="text-xs text-app-muted">
              System: {line.systemQty} {line.unit}
            </Text>
          </View>
          <TextInput
            value={line.countedQty}
            onChangeText={(v) => updateCount(line.productId, v)}
            keyboardType="decimal-pad"
            className="w-20 rounded-lg border border-app-border bg-app-bg px-2 py-2 text-center text-app-text"
          />
        </View>
      ))}

      <Pressable
        disabled={saving}
        onPress={() => void applyVariances()}
        className="mb-8 mt-2 rounded-xl py-4"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-center font-semibold text-white">
          {saving ? 'Saving…' : 'Post variances as adjustments'}
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}
