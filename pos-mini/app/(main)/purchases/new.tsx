import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import Toast from 'react-native-toast-message';
import { EmptyState } from '../../../src/components/EmptyState';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { BarcodeScannerModal } from '../../../src/components/BarcodeScannerModal';
import { NumericKeypad } from '../../../src/components/NumericKeypad';
import { ProductCard } from '../../../src/components/ProductCard';
import { SearchBar } from '../../../src/components/SearchBar';
import { createPurchase } from '../../../src/repositories/purchaseRepository';
import { listProducts, searchProducts, getProductByBarcode } from '../../../src/repositories/productRepository';
import { listSuppliers } from '../../../src/repositories/supplierRepository';
import type { Product, Supplier } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { useThemedStyles } from '../../../src/hooks/useTheme';
import { calculateCartTax, calculateCartTotal, calculateSubtotal, roundMoney } from '../../../src/utils/calculations';
import { QuantityEditModal } from '../../../src/components/QuantityEditModal';
import { formatMoney } from '../../../src/utils/currency';
import { formatQuantity, parseQuantityInput } from '../../../src/utils/quantity';

type CartLine = {
  productId: string;
  productName: string;
  unitCost: number;
  quantity: number;
  isTaxable: boolean;
  taxRate: number;
  taxInclusive: boolean;
};

const STEPS = ['Supplier', 'Items', 'Payment'] as const;

export default function NewPurchaseScreen() {
  const { cardStyle, colors } = useThemedStyles();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const refreshStats = useAppStore((s) => s.refreshStats);
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [payInput, setPayInput] = useState('');
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [costInput, setCostInput] = useState('');
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [prods, sups] = await Promise.all([
          query ? searchProducts(query) : listProducts(),
          listSuppliers(),
        ]);
        setProducts(prods);
        setSuppliers(sups);
      })();
    }, [query]),
  );

  const subtotal = useMemo(
    () => calculateSubtotal(lines.map((l) => ({ unitPrice: l.unitCost, quantity: l.quantity }))),
    [lines],
  );
  const taxAmount = useMemo(
    () => roundMoney(calculateCartTax(lines.map((l) => ({
      unitPrice: l.unitCost,
      quantity: l.quantity,
      isTaxable: l.isTaxable,
      taxRate: l.taxRate,
      taxInclusive: l.taxInclusive,
    })), 0)),
    [lines],
  );
  const total = useMemo(
    () => roundMoney(calculateCartTotal(lines.map((l) => ({
      unitPrice: l.unitCost,
      quantity: l.quantity,
      isTaxable: l.isTaxable,
      taxRate: l.taxRate,
      taxInclusive: l.taxInclusive,
    })), 0)),
    [lines],
  );

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  const addProduct = (product: Product) => {
    const existing = lines.find((l) => l.productId === product.id);
    if (existing) {
      setLines(lines.map((l) =>
        l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
      ));
    } else {
      setLines([...lines, {
        productId: product.id,
        productName: product.name,
        unitCost: product.costPrice,
        quantity: 1,
        isTaxable: product.isTaxable,
        taxRate: product.taxRate,
        taxInclusive: product.taxInclusive,
      }]);
    }
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setLines(lines.filter((l) => l.productId !== productId));
    } else {
      setLines(lines.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)));
    }
  };

  const editingQtyLine = editingQty ? lines.find((l) => l.productId === editingQty) : null;

  const saveQty = () => {
    if (!editingQty) return;
    const qty = parseQuantityInput(qtyInput);
    if (!qty) {
      Toast.show({ type: 'error', text1: 'Enter a valid quantity' });
      return;
    }
    updateQty(editingQty, qty);
    setEditingQty(null);
  };

  const saveCost = () => {
    if (!editingCost) return;
    const cost = Number(costInput) || 0;
    setLines(lines.map((l) => (l.productId === editingCost ? { ...l, unitCost: cost } : l)));
    setEditingCost(null);
    setCostInput('');
  };

  const handleBarcodeScan = async (barcode: string) => {
    const product = await getProductByBarcode(barcode);
    if (!product) {
      Toast.show({ type: 'error', text1: 'Product not found', text2: barcode });
      return;
    }
    addProduct(product);
    Toast.show({ type: 'success', text1: product.name, text2: 'Added' });
  };

  const completePurchase = async () => {
    if (lines.length === 0) {
      Toast.show({ type: 'error', text1: 'Add at least one product' });
      return;
    }
    const paid = Number(payInput) || total;

    try {
      const purchase = await createPurchase({
        supplierId,
        items: lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          unitCost: l.unitCost,
          quantity: l.quantity,
          lineTotal: roundMoney(l.unitCost * l.quantity),
        })),
        subtotal,
        taxAmount,
        total,
        amountPaid: paid,
      });
      await refreshStats();
      Toast.show({ type: 'success', text1: 'Purchase saved', text2: purchase.poNumber });
      router.replace(`/(main)/purchases/${purchase.id}`);
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Purchase failed' });
    }
  };

  const goNext = () => {
    if (step === 1 && lines.length === 0) {
      Toast.show({ type: 'error', text1: 'Add at least one item' });
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  };

  if (editingCost) {
    return (
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text className="mb-2 text-xl font-bold text-app-text">Unit Cost</Text>
        <NumericKeypad value={costInput} onChange={setCostInput} />
        <Pressable onPress={saveCost} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold text-white">Apply</Text>
        </Pressable>
        <Pressable onPress={() => setEditingCost(null)} className="mt-2 rounded-xl border border-app-border py-3">
          <Text className="text-center font-semibold text-app-text">Cancel</Text>
        </Pressable>
      </KeyboardFormScroll>
    );
  }

  return (
    <ScreenContainer padded={false} style={{ flex: 1 }}>
      <View className="flex-row border-b border-app-border px-4 py-3">
        {STEPS.map((label, i) => (
          <View key={label} className="mr-4 flex-row items-center">
            <View
              className="mr-2 h-7 w-7 items-center justify-center rounded-full"
              style={{
                backgroundColor: i <= step ? colors.primary : colors.border,
              }}
            >
              <Text className="text-sm font-bold text-white">{i + 1}</Text>
            </View>
            <Text
              className="font-semibold"
              style={{ color: i <= step ? colors.text : colors.textMuted }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {step === 0 ? (
        <ScrollView style={{ flex: 1 }} className="px-4 pt-4">
          <Text className="mb-2 font-semibold text-app-text">Select supplier (optional)</Text>
          <Pressable
            onPress={() => setSupplierId(null)}
            style={cardStyle}
            className={`mb-2 p-4 ${!supplierId ? 'border-app-primary' : ''}`}
          >
            <Text className="font-semibold text-app-text">No supplier</Text>
          </Pressable>
          {suppliers.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSupplierId(s.id)}
              style={cardStyle}
              className={`mb-2 p-4 ${supplierId === s.id ? 'border-app-primary' : ''}`}
            >
              <Text className="font-semibold text-app-text">{s.name}</Text>
              {s.phone ? <Text className="text-sm text-app-muted">{s.phone}</Text> : null}
            </Pressable>
          ))}
          <Pressable onPress={goNext} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold text-white">Next: Add items</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {step === 1 ? (
        <View className="min-h-0 flex-1 px-4 pt-2">
          <Text className="mb-2 text-sm text-app-muted">
            Supplier: {selectedSupplier?.name ?? 'None'}
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

          {lines.length > 0 ? (
            <View className="mb-2 min-h-0" style={{ maxHeight: 160 }}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled>
                {lines.map((line) => (
                  <View key={line.productId} style={cardStyle} className="mb-2 p-3">
                    <Text className="font-semibold text-app-text">{line.productName}</Text>
                    <View className="mt-1 flex-row items-center justify-between">
                      <Pressable onPress={() => { setEditingCost(line.productId); setCostInput(String(line.unitCost)); }}>
                        <Text className="text-sm text-app-muted">
                          Cost: {formatMoney(line.unitCost, settings)}
                        </Text>
                      </Pressable>
                      <View className="flex-row items-center gap-2">
                        <Pressable onPress={() => updateQty(line.productId, line.quantity - 1)} className="rounded border border-app-border px-2">
                          <Text className="font-bold text-app-text">−</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setEditingQty(line.productId);
                            setQtyInput(formatQuantity(line.quantity));
                          }}
                          className="min-w-[28px] rounded border border-app-border px-2 py-0.5"
                        >
                          <Text className="text-center font-bold text-app-text">{formatQuantity(line.quantity)}</Text>
                        </Pressable>
                        <Pressable onPress={() => updateQty(line.productId, line.quantity + 1)} className="rounded border border-app-border px-2">
                          <Text className="font-bold text-app-text">+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View className="min-h-0 flex-1">
            {products.length === 0 ? (
              <EmptyState title="No products" message="Add products first." />
            ) : (
              <FlashList
                data={products}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                renderItem={({ item }) => <ProductCard product={item} onAdd={() => addProduct(item)} />}
              />
            )}
          </View>

          <View className="flex-row gap-2 py-3">
            <Pressable onPress={() => setStep(0)} className="flex-1 rounded-xl border border-app-border py-3">
              <Text className="text-center font-semibold text-app-text">Back</Text>
            </Pressable>
            <Pressable onPress={goNext} className="flex-1 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
              <Text className="text-center font-semibold text-white">
                Next · {formatMoney(total, settings)}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text className="mb-2 text-xl font-bold text-app-text">Review & pay</Text>
          <View style={cardStyle} className="mb-4 p-4">
            <Text className="mb-2 text-app-muted">Supplier: {selectedSupplier?.name ?? 'None'}</Text>
            {lines.map((l) => (
              <View key={l.productId} className="mb-1 flex-row justify-between">
                <Text className="text-app-text">{l.productName} × {l.quantity}</Text>
                <Text className="text-app-text">{formatMoney(l.unitCost * l.quantity, settings)}</Text>
              </View>
            ))}
            <View className="mt-3 border-t border-app-border pt-2">
              <Text className="text-lg font-bold text-app-text">
                Total: {formatMoney(total, settings)}
              </Text>
            </View>
          </View>
          <Text className="mb-2 font-semibold text-app-text">Amount paid</Text>
          <NumericKeypad value={payInput} onChange={setPayInput} />
          <Pressable onPress={() => void completePurchase()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold text-white">Save purchase</Text>
          </Pressable>
          <Pressable onPress={() => setStep(1)} className="mt-2 rounded-xl border border-app-border py-3">
            <Text className="text-center font-semibold text-app-text">Back</Text>
          </Pressable>
        </KeyboardFormScroll>
      ) : null}

      <QuantityEditModal
        visible={editingQtyLine != null}
        title={editingQtyLine?.productName ?? 'Quantity'}
        value={qtyInput}
        onChange={setQtyInput}
        onApply={saveQty}
        onCancel={() => setEditingQty(null)}
      />

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={(barcode) => void handleBarcodeScan(barcode)}
      />
    </ScreenContainer>
  );
}
