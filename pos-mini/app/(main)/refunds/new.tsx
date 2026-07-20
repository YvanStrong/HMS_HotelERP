import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import Toast from 'react-native-toast-message';
import { BarcodeScannerModal } from '../../../src/components/BarcodeScannerModal';
import { EmptyState } from '../../../src/components/EmptyState';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { ProductCard } from '../../../src/components/ProductCard';
import { SearchBar } from '../../../src/components/SearchBar';
import { REFUND_REASON_CODES } from '../../../src/constants/refundReasons';
import { createRefund, getRefundableQuantities } from '../../../src/repositories/refundRepository';
import { getProductByBarcode, listProducts, searchProducts } from '../../../src/repositories/productRepository';
import { getSaleByInvoiceNumber, getSaleWithItems, listSales } from '../../../src/repositories/saleRepository';
import type { Product, Sale } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { useThemedStyles } from '../../../src/hooks/useTheme';
import { calculateSubtotal, roundMoney } from '../../../src/utils/calculations';
import { formatMoney } from '../../../src/utils/currency';

type RefundLine = {
  productId: string;
  productName: string;
  unitPrice: number;
  maxQty: number;
  quantity: number;
  restock: boolean;
  reasonCode: string;
};

type RefundMode = 'sale' | 'manual';

export default function NewRefundScreen() {
  const { cardStyle, colors } = useThemedStyles();
  const router = useRouter();
  const { saleId: presetSaleId } = useLocalSearchParams<{ saleId?: string }>();
  const settings = useAppStore((s) => s.settings);
  const refreshStats = useAppStore((s) => s.refreshStats);
  const [mode, setMode] = useState<RefundMode>('sale');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [lines, setLines] = useState<RefundLine[]>([]);
  const [reason, setReason] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const loadSale = useCallback(async (s: Sale) => {
    const full = await getSaleWithItems(s.id);
    if (!full?.items?.length) {
      Toast.show({ type: 'error', text1: 'Sale has no items' });
      return;
    }
    const refundable = await getRefundableQuantities(s.id);
    setSale(full);
    setMode('sale');
    setLines(full.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      maxQty: refundable[item.productId] ?? item.quantity,
      quantity: 0,
      restock: true,
      reasonCode: 'customer_changed',
    })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void listSales(20).then(setRecentSales);
      if (presetSaleId) {
        void getSaleWithItems(presetSaleId).then((full) => {
          if (full) void loadSale(full);
        });
      }
    }, [presetSaleId, loadSale]),
  );

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'manual') return;
      void (query ? searchProducts(query) : listProducts()).then(setProducts);
    }, [mode, query]),
  );

  const subtotal = useMemo(
    () => calculateSubtotal(lines.filter((l) => l.quantity > 0).map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
    }))),
    [lines],
  );

  const switchMode = (next: RefundMode) => {
    setMode(next);
    setSale(null);
    setLines([]);
    setInvoiceQuery('');
  };

  const searchInvoice = async () => {
    if (!invoiceQuery.trim()) return;
    const found = await getSaleByInvoiceNumber(invoiceQuery.trim());
    if (!found) {
      Toast.show({ type: 'error', text1: 'Sale not found' });
      return;
    }
    await loadSale(found);
  };

  const addManualProduct = (product: Product) => {
    const existing = lines.find((l) => l.productId === product.id);
    if (existing) {
      setLines(lines.map((l) =>
        l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
      ));
    } else {
      setLines([...lines, {
        productId: product.id,
        productName: product.name,
        unitPrice: product.sellPrice,
        maxQty: 9999,
        quantity: 1,
        restock: true,
        reasonCode: 'customer_changed',
      }]);
    }
  };

  const handleBarcodeScan = async (code: string) => {
    const product = await getProductByBarcode(code);
    if (!product) {
      Toast.show({ type: 'error', text1: 'Product not found' });
      return;
    }
    addManualProduct(product);
  };

  const updateLineQty = (productId: string, qty: number) => {
    setLines(lines.map((l) => {
      if (l.productId !== productId) return l;
      return { ...l, quantity: Math.max(0, Math.min(l.maxQty, qty)) };
    }));
  };

  const submitRefund = async () => {
    const selected = lines.filter((l) => l.quantity > 0);
    if (selected.length === 0) {
      Toast.show({ type: 'error', text1: 'Select items to refund' });
      return;
    }

    try {
      const refund = await createRefund({
        saleId: mode === 'sale' ? sale?.id ?? null : null,
        items: selected.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          lineTotal: roundMoney(l.unitPrice * l.quantity),
          restock: l.restock,
          reasonCode: l.reasonCode,
        })),
        subtotal,
        total: subtotal,
        reason: reason || null,
      });
      await refreshStats();
      Toast.show({ type: 'success', text1: 'Refund created', text2: refund.refundNumber });
      router.replace(`/(main)/refunds/${refund.id}`);
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Refund failed' });
    }
  };

  const modeTabs = (
    <View className="mb-3 flex-row gap-2">
      {(['sale', 'manual'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => switchMode(m)}
          className="flex-1 rounded-lg border py-2"
          style={{
            borderColor: mode === m ? colors.primary : colors.border,
            backgroundColor: mode === m ? colors.primarySoft : colors.surface,
          }}
        >
          <Text className="text-center font-semibold capitalize text-app-text">
            {m === 'sale' ? 'From sale' : 'Manual'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (mode === 'sale' && !sale) {
    return (
      <ScreenContainer padded={false} style={{ flex: 1 }}>
        <View className="min-h-0 flex-1 px-4 pt-2">
          {modeTabs}
          <Text className="mb-2 font-bold text-app-text">Find sale by invoice</Text>
          <View className="mb-4 flex-row gap-2">
            <TextInput
              value={invoiceQuery}
              onChangeText={setInvoiceQuery}
              placeholder="INV-00001"
              autoCapitalize="characters"
              className="flex-1 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
            />
            <Pressable
              onPress={() => void searchInvoice()}
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="font-bold text-white">Find</Text>
            </Pressable>
          </View>

          <Text className="mb-2 font-bold text-app-text">Recent sales</Text>
          {recentSales.length === 0 ? (
            <EmptyState title="No sales" message="Complete a sale first." />
          ) : (
            <View className="min-h-0 flex-1">
              <FlashList
                data={recentSales}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => void loadSale(item)} style={cardStyle} className="mb-2 p-3">
                    <View className="flex-row justify-between">
                      <Text className="font-bold text-app-text">{item.invoiceNumber}</Text>
                      <Text className="font-bold text-app-text">{formatMoney(item.total, settings)}</Text>
                    </View>
                    <Text className="text-sm text-app-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      </ScreenContainer>
    );
  }

  if (mode === 'manual' && lines.length === 0) {
    return (
      <ScreenContainer padded={false} style={{ flex: 1 }}>
        <View className="min-h-0 flex-1 px-4 pt-2">
          {modeTabs}
          <Text className="mb-2 text-sm text-app-muted">
            Refund without linking to an original sale. Add products below.
          </Text>
          <View className="mb-2 flex-row gap-2">
            <View className="flex-1">
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search products…" />
            </View>
            <Pressable
              onPress={() => setShowScanner(true)}
              className="rounded-xl border border-app-border bg-app-surface px-4 py-2"
            >
              <Text className="font-semibold text-app-text">Scan</Text>
            </Pressable>
          </View>
          <View className="min-h-0 flex-1">
            <FlashList
              data={products}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <ProductCard product={item} onAdd={() => addManualProduct(item)} />
              )}
              ListEmptyComponent={<EmptyState title="No products" message="Add products first." />}
            />
          </View>
        </View>
        <BarcodeScannerModal
          visible={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={(code) => void handleBarcodeScan(code)}
        />
      </ScreenContainer>
    );
  }

  return (
    <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {modeTabs}
      {mode === 'sale' && sale ? (
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-bold text-app-text">{sale.invoiceNumber}</Text>
          <Pressable onPress={() => { setSale(null); setLines([]); }} className="rounded border border-app-border px-2 py-1">
            <Text className="text-sm font-bold text-app-text">Change</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setLines([])}
          className="mb-3 self-start rounded border border-app-border px-2 py-1"
        >
          <Text className="text-sm font-bold text-app-text">Add more items</Text>
        </Pressable>
      )}

      {lines.map((line) => (
        <View key={line.productId} style={cardStyle} className="mb-2 p-3">
          <Text className="font-bold text-app-text">{line.productName}</Text>
          <Text className="text-sm text-app-muted">
            {mode === 'sale' ? `${line.maxQty} refundable · ` : ''}
            {formatMoney(line.unitPrice, settings)} each
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => updateLineQty(line.productId, line.quantity - 1)} className="rounded border border-app-border px-3 py-1">
                <Text className="font-bold text-app-text">−</Text>
              </Pressable>
              <Text className="min-w-[24px] text-center font-bold text-app-text">{line.quantity}</Text>
              <Pressable onPress={() => updateLineQty(line.productId, line.quantity + 1)} className="rounded border border-app-border px-3 py-1">
                <Text className="font-bold text-app-text">+</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-app-text">Restock</Text>
              <Switch
                value={line.restock}
                onValueChange={(v) =>
                  setLines(lines.map((l) => (l.productId === line.productId ? { ...l, restock: v } : l)))
                }
              />
            </View>
          </View>
          {line.quantity > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              {REFUND_REASON_CODES.map((r) => (
                <Pressable
                  key={r.code}
                  onPress={() =>
                    setLines(lines.map((l) => (l.productId === line.productId ? { ...l, reasonCode: r.code } : l)))
                  }
                  className="mr-2 rounded-lg border px-2 py-1"
                  style={{
                    borderColor: line.reasonCode === r.code ? colors.primary : colors.border,
                    backgroundColor: line.reasonCode === r.code ? colors.primarySoft : colors.surface,
                  }}
                >
                  <Text className="text-xs font-semibold text-app-text">{r.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <Text className="mt-1 text-right font-bold text-app-text">
            {formatMoney(line.unitPrice * line.quantity, settings)}
          </Text>
        </View>
      ))}

      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Reason (optional)"
        className="mb-3 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
      />

      <Text className="mb-3 text-center font-bold text-app-text">
        Refund total: {formatMoney(subtotal, settings)}
      </Text>

      <Pressable
        onPress={() => void submitRefund()}
        className="rounded-xl py-4"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-center font-bold text-white">Create refund</Text>
      </Pressable>
    </KeyboardFormScroll>
  );
}
