import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { BarcodeScannerModal } from '../../../src/components/BarcodeScannerModal';
import { CategoryFilterTabs } from '../../../src/components/CategoryFilterTabs';
import { CustomerPickerModal } from '../../../src/components/CustomerPickerModal';
import { EmptyState } from '../../../src/components/EmptyState';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { NumericKeypad } from '../../../src/components/NumericKeypad';
import { ProductCard } from '../../../src/components/ProductCard';
import { SearchBar } from '../../../src/components/SearchBar';
import { SwipeableCartItem } from '../../../src/components/SwipeableCartItem';
import { findBestDiscountRule, listDiscountRules } from '../../../src/repositories/discountRepository';
import { listCategories } from '../../../src/repositories/categoryRepository';
import { listCustomers } from '../../../src/repositories/customerRepository';
import { deleteHeldCart, listHeldCarts, saveHeldCart } from '../../../src/repositories/heldCartRepository';
import { getPaymentMethodSettings, getPrinterSettings, type PaymentMethodSettings } from '../../../src/repositories/metaRepository';
import { findProductByScaleCode, getProductByBarcode, listProducts, searchProducts } from '../../../src/repositories/productRepository';
import { createSale } from '../../../src/repositories/saleRepository';
import { printReceipt } from '../../../src/printing/PrinterService';
import type { Category, CartItem, Customer, DiscountMode, DiscountType, HeldCart, PaymentMethod, Product, SalePaymentInput } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { useCartStore } from '../../../src/store/cartStore';
import { parseScaleBarcode } from '../../../src/utils/barcode';
import { cardStyle, colors } from '../../../src/constants/theme';
import { formatMoney } from '../../../src/utils/currency';
import { roundMoney } from '../../../src/utils/calculations';

function chipStyle(selected: boolean) {
  return {
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? colors.primarySoft : colors.surface,
  };
}

function buildPaymentMethods(prefs: PaymentMethodSettings): { method: SalePaymentInput['paymentMethod']; label: string }[] {
  const list: { method: SalePaymentInput['paymentMethod']; label: string }[] = [{ method: 'cash', label: 'Cash' }];
  if (prefs.cardEnabled) list.push({ method: 'card', label: 'Card' });
  if (prefs.mobileEnabled) list.push({ method: 'mobile', label: prefs.mobileMoneyLabel || 'Mobile' });
  if (prefs.creditEnabled) list.push({ method: 'credit', label: 'Credit' });
  return list;
}

export default function NewSaleScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const refreshStats = useAppStore((s) => s.refreshStats);
  const cart = useCartStore();
  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    customerId,
    setCustomer,
    discountMode,
    setDiscountMode,
    setDiscountPercent,
    setFixedDiscount,
    setManualDiscount,
    manualDiscountType,
    manualDiscountValue,
    discountPercent,
    fixedDiscount,
    paymentMethod,
    setPaymentMethod,
    amountPaid,
    setAmountPaid,
    notes,
    setNotes,
    splitEnabled,
    setSplitEnabled,
    splitPayments,
    addSplitPayment,
    removeSplitPayment,
    getTotals,
    toSaleItems,
    getSnapshot,
    loadSnapshot,
    clear,
  } = cart;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentPrefs, setPaymentPrefs] = useState<PaymentMethodSettings | null>(null);
  const [query, setQuery] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showManualDisc, setShowManualDisc] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [manualType, setManualType] = useState<DiscountType>('percent');
  const [manualValue, setManualValue] = useState('');
  const [payInput, setPayInput] = useState('');
  const [splitMethod, setSplitMethod] = useState<SalePaymentInput['paymentMethod']>('cash');
  const [splitAmount, setSplitAmount] = useState('');
  const totals = getTotals();

  const paymentMethods = useMemo(
    () => buildPaymentMethods(paymentPrefs ?? { cardEnabled: true, mobileEnabled: true, creditEnabled: true, mobileMoneyLabel: 'Mobile' }),
    [paymentPrefs],
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [list, custs, cats, prefs] = await Promise.all([
          query ? searchProducts(query) : listProducts(),
          listCustomers(),
          listCategories(),
          getPaymentMethodSettings(),
        ]);
        setProducts(list);
        setCustomers(custs);
        setCategories(cats);
        setPaymentPrefs(prefs);
      })();
    }, [query]),
  );

  const filteredProducts = useMemo(() => {
    if (!categoryId) return products;
    return products.filter((p) => p.categoryId === categoryId);
  }, [products, categoryId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const splitPaidTotal = useMemo(
    () => roundMoney(splitPayments.reduce((s, p) => s + p.amount, 0)),
    [splitPayments],
  );

  const addProduct = (product: Product, qty = 1, unitPrice?: number) => {
    if (product.trackStock && product.stockQty <= 0) {
      Toast.show({ type: 'error', text1: 'Out of stock' });
      return;
    }
    const existing = items.find((i) => i.productId === product.id);
    const nextQty = (existing?.quantity ?? 0) + qty;
    if (product.trackStock && nextQty > product.stockQty) {
      Toast.show({ type: 'error', text1: 'Not enough stock' });
      return;
    }
    addItem({
      productId: product.id,
      productName: product.name,
      unitPrice: unitPrice ?? product.sellPrice,
      costPrice: product.costPrice,
      unit: product.unit,
      taxClass: product.taxClass,
      trackStock: product.trackStock,
      stockQty: product.stockQty,
      imageUri: product.imageUri,
      quantity: qty,
    });
  };

  const setItemQuantity = (item: CartItem, qty: number) => {
    if (item.trackStock && qty > item.stockQty) {
      Toast.show({ type: 'error', text1: 'Not enough stock' });
      return;
    }
    updateQuantity(item.productId, qty);
  };

  const handleBarcodeScan = async (barcode: string) => {
    const scale = parseScaleBarcode(barcode);
    if (scale) {
      const product = await findProductByScaleCode(scale.productCode);
      if (!product) {
        Toast.show({ type: 'error', text1: 'Scale product not found' });
        return;
      }
      if (scale.weightKg) {
        addProduct(product, scale.weightKg, product.sellPrice);
        Toast.show({ type: 'success', text1: product.name, text2: `${scale.weightKg} kg` });
        return;
      }
      if (scale.price) {
        const qty = product.sellPrice > 0 ? roundMoney(scale.price / product.sellPrice) : 1;
        addProduct(product, qty, product.sellPrice);
        Toast.show({ type: 'success', text1: product.name, text2: formatMoney(scale.price, settings) });
        return;
      }
    }
    const product = await getProductByBarcode(barcode);
    if (!product) {
      Toast.show({ type: 'error', text1: 'Product not found', text2: barcode });
      return;
    }
    addProduct(product);
    Toast.show({ type: 'success', text1: product.name, text2: 'Added to cart' });
  };

  const applyRuleDiscount = async () => {
    const rules = await listDiscountRules();
    const best = findBestDiscountRule(rules, totals.subtotal);
    if (!best) {
      Toast.show({ type: 'info', text1: 'No discount rules apply' });
      return;
    }
    setDiscountMode('rule');
    setDiscountPercent(best.percent);
    setFixedDiscount(best.fixed);
    Toast.show({ type: 'success', text1: best.ruleName ?? 'Discount applied' });
  };

  const applyManualDiscount = () => {
    const val = Number(manualValue) || 0;
    if (val <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid discount' });
      return;
    }
    setDiscountMode('manual');
    setManualDiscount(manualType, val);
    setShowManualDisc(false);
  };

  const holdCart = async () => {
    if (items.length === 0) {
      Toast.show({ type: 'error', text1: 'Cart is empty' });
      return;
    }
    await saveHeldCart(getSnapshot(), `Hold ${new Date().toLocaleTimeString()}`);
    clear();
    Toast.show({ type: 'success', text1: 'Sale held' });
  };

  const openHeld = async () => {
    setHeldCarts(await listHeldCarts());
    setShowHeld(true);
  };

  const resumeHeld = async (held: HeldCart) => {
    loadSnapshot(JSON.parse(held.cartJson));
    await deleteHeldCart(held.id);
    setShowHeld(false);
    Toast.show({ type: 'success', text1: 'Cart restored' });
  };

  const addSplitLine = () => {
    const amount = Number(splitAmount);
    if (!amount || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' });
      return;
    }
    addSplitPayment({ paymentMethod: splitMethod, amount });
    setSplitAmount('');
  };

  const completeSale = async () => {
    if (items.length === 0) {
      Toast.show({ type: 'error', text1: 'Cart is empty' });
      return;
    }
    if (splitEnabled) {
      if (splitPaidTotal < totals.total) {
        Toast.show({ type: 'error', text1: 'Split payments do not cover total' });
        return;
      }
      if (splitPayments.some((p) => p.paymentMethod === 'credit') && !customerId) {
        Toast.show({ type: 'error', text1: 'Credit split requires a customer' });
        return;
      }
    } else if (paymentMethod === 'credit' && !customerId) {
      Toast.show({ type: 'error', text1: 'Select a customer for credit sales' });
      setShowCustomerPicker(true);
      return;
    }

    const paid = splitEnabled
      ? splitPaidTotal
      : paymentMethod === 'credit'
        ? totals.total
        : Number(payInput) || amountPaid;

    if (!splitEnabled && paymentMethod !== 'credit' && paid < totals.total) {
      Toast.show({ type: 'error', text1: 'Insufficient payment' });
      return;
    }

    try {
      const sale = await createSale({
        customerId: customerId ?? null,
        items: toSaleItems(),
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        discountPercent,
        taxAmount: totals.taxAmount,
        total: totals.total,
        amountPaid: paid,
        changeAmount: splitEnabled ? Math.max(0, paid - totals.total) : paymentMethod === 'credit' ? 0 : Math.max(0, paid - totals.total),
        paymentMethod: splitEnabled ? 'split' : paymentMethod,
        notes: notes.trim() || null,
        payments: splitEnabled ? splitPayments : undefined,
      });
      clear();
      await refreshStats();

      const printer = await getPrinterSettings();
      if (printer.autoPrint && settings) {
        try {
          await printReceipt(sale, sale.items ?? [], settings);
        } catch {
          // non-blocking
        }
      }

      Toast.show({ type: 'success', text1: 'Sale completed', text2: sale.invoiceNumber });
      router.replace(`/(main)/sales/${sale.id}`);
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Sale failed' });
    }
  };

  const customerBanner = (
    <View className="mb-3">
      {selectedCustomer ? (
        <View style={[cardStyle, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]} className="flex-row items-center justify-between p-3">
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-xs font-semibold uppercase text-app-muted">Customer</Text>
            <Text className="font-semibold text-app-text" numberOfLines={1}>{selectedCustomer.name}</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setShowCustomerPicker(true)} className="rounded-lg border border-app-border bg-app-surface px-3 py-2">
              <Text className="text-sm font-medium text-app-text">Change</Text>
            </Pressable>
            <Pressable onPress={() => setCustomer(null)} className="rounded-lg p-2">
              <Ionicons name="close-circle" size={24} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setShowCustomerPicker(true)} style={cardStyle} className="flex-row items-center justify-between p-3">
          <Text className="font-medium text-app-text">Attach customer (optional)</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );

  const discountChip = (
    <View className="mb-2 flex-row flex-wrap gap-2">
      {(['off', 'rule', 'manual'] as DiscountMode[]).map((mode) => (
        <Pressable
          key={mode}
          onPress={() => {
            if (mode === 'off') setDiscountMode('off');
            else if (mode === 'rule') void applyRuleDiscount();
            else setShowManualDisc(true);
          }}
          className="rounded-lg border px-3 py-1.5"
          style={chipStyle(discountMode === mode)}
        >
          <Text className="text-sm font-semibold capitalize text-app-text">{mode}</Text>
        </Pressable>
      ))}
      <Text className="font-semibold text-app-text">
        {formatMoney(totals.total, settings)} ({totals.itemCount})
      </Text>
    </View>
  );

  if (showPay) {
    return (
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text className="mb-2 text-xl font-bold text-app-text">Payment</Text>
        <Text className="mb-3 text-app-muted">Total: {formatMoney(totals.total, settings)}</Text>
        {customerBanner}

        <Pressable onPress={() => setSplitEnabled(!splitEnabled)} className="mb-3 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
          <Text className="font-semibold text-app-text">Split payment</Text>
          <Text className="font-semibold text-app-primary">{splitEnabled ? 'On' : 'Off'}</Text>
        </Pressable>

        {splitEnabled ? (
          <View className="mb-4">
            {splitPayments.map((p, i) => (
              <View key={`${p.paymentMethod}-${i}`} className="mb-2 flex-row items-center justify-between rounded-lg border border-app-border p-2">
                <Text className="capitalize text-app-text">{p.paymentMethod}</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="font-bold text-app-text">{formatMoney(p.amount, settings)}</Text>
                  <Pressable onPress={() => removeSplitPayment(i)}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Text className="mb-2 text-sm text-app-muted">
              Remaining: {formatMoney(Math.max(0, totals.total - splitPaidTotal), settings)}
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
              {paymentMethods.map((m) => (
                <Pressable key={m.method} onPress={() => setSplitMethod(m.method)} className="rounded-lg border px-3 py-1.5" style={chipStyle(splitMethod === m.method)}>
                  <Text className="text-sm font-semibold text-app-text">{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <NumericKeypad value={splitAmount} onChange={setSplitAmount} />
            <Pressable onPress={addSplitLine} className="mt-2 rounded-xl border border-app-border py-2">
              <Text className="text-center font-semibold text-app-text">Add payment line</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="mb-2 text-sm font-semibold text-app-text">Payment method</Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {paymentMethods.map((m) => (
                <Pressable key={m.method} onPress={() => setPaymentMethod(m.method)} className="rounded-lg border px-4 py-2" style={chipStyle(paymentMethod === m.method)}>
                  <Text className="font-semibold text-app-text">{m.label}</Text>
                </Pressable>
              ))}
            </View>
            {paymentMethod !== 'credit' ? (
              <NumericKeypad value={payInput} onChange={(v) => { setPayInput(v); setAmountPaid(Number(v) || 0); }} />
            ) : (
              <Text className="mb-4 text-sm text-app-muted">Full amount added to customer debt.</Text>
            )}
          </>
        )}

        <FormField label="Sale notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />

        <Pressable onPress={() => void completeSale()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold text-white">Complete sale</Text>
        </Pressable>
        <Pressable onPress={() => setShowPay(false)} className="mt-2 rounded-xl border border-app-border py-3">
          <Text className="text-center font-semibold text-app-text">Back to cart</Text>
        </Pressable>

        <CustomerPickerModal visible={showCustomerPicker} selectedId={customerId} onClose={() => setShowCustomerPicker(false)} onSelect={(c) => { setCustomer(c.id); setCustomers((prev) => prev.some((x) => x.id === c.id) ? prev : [...prev, c]); }} />
      </KeyboardFormScroll>
    );
  }

  return (
    <ScreenContainer padded={false} style={{ flex: 1 }}>
      <View className="min-h-0 flex-1 border-b border-app-border px-4 pt-2">
        <View className="mb-2 flex-row gap-2">
          <View className="min-w-0 flex-1">
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search products…" />
          </View>
          <Pressable onPress={() => setShowScanner(true)} className="rounded-xl border border-app-border bg-app-surface px-4 py-2">
            <Text className="font-semibold text-app-text">Scan</Text>
          </Pressable>
        </View>
        <CategoryFilterTabs categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
        <View className="min-h-0 flex-1">
          {filteredProducts.length === 0 ? (
            <EmptyState title="No products" message="Add products or change filter." />
          ) : (
            <FlashList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => <ProductCard product={item} onAdd={() => addProduct(item)} />}
            />
          )}
        </View>
      </View>

      <View className="min-h-0 flex-1 px-4 pt-2">
        {customerBanner}
        {discountChip}
        <View className="mb-2 min-h-0 flex-1">
          {items.length > 0 ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
              {items.map((item) => (
                <SwipeableCartItem
                  key={item.productId}
                  item={item}
                  onIncrease={() => updateQuantity(item.productId, item.quantity + 1)}
                  onDecrease={() => updateQuantity(item.productId, item.quantity - 1)}
                  onRemove={() => removeItem(item.productId)}
                  onSetQuantity={(qty) => setItemQuantity(item, qty)}
                />
              ))}
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-app-muted">Tap products above to add to cart</Text>
            </View>
          )}
        </View>
        <View className="mb-2 flex-row gap-2">
          <Pressable onPress={() => (items.length ? setShowPay(true) : Toast.show({ type: 'error', text1: 'Cart is empty' }))} className="flex-1 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold text-white">Checkout</Text>
          </Pressable>
          <Pressable onPress={() => void holdCart()} className="rounded-xl border border-app-border bg-app-surface px-3 py-3">
            <Text className="font-semibold text-app-text">Hold</Text>
          </Pressable>
          <Pressable onPress={() => void openHeld()} className="rounded-xl border border-app-border bg-app-surface px-3 py-3">
            <Text className="font-semibold text-app-text">Held</Text>
          </Pressable>
          <Pressable onPress={() => clear()} className="rounded-xl border border-app-border bg-app-surface px-3 py-3">
            <Text className="font-semibold text-app-text">Clear</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={showManualDisc} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-2xl bg-app-surface p-4">
            <Text className="mb-3 text-lg font-bold text-app-text">Manual discount</Text>
            <View className="mb-3 flex-row gap-2">
              {(['percent', 'fixed'] as DiscountType[]).map((t) => (
                <Pressable key={t} onPress={() => setManualType(t)} className="flex-1 rounded-lg border py-2" style={chipStyle(manualType === t)}>
                  <Text className="text-center font-semibold text-app-text">{t === 'percent' ? '%' : 'Fixed'}</Text>
                </Pressable>
              ))}
            </View>
            <FormField label="Value" value={manualValue} onChangeText={setManualValue} keyboardType="decimal-pad" />
            <Pressable onPress={applyManualDiscount} className="mt-3 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
              <Text className="text-center font-semibold text-white">Apply</Text>
            </Pressable>
            <Pressable onPress={() => setShowManualDisc(false)} className="mt-2 py-2">
              <Text className="text-center text-app-muted">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showHeld} transparent animationType="fade">
        <Pressable className="flex-1 justify-center bg-black/40 p-4" onPress={() => setShowHeld(false)}>
          <View className="rounded-xl bg-app-surface p-4">
            <Text className="mb-3 text-lg font-bold text-app-text">Held sales</Text>
            {heldCarts.length === 0 ? (
              <Text className="text-app-muted">No held carts.</Text>
            ) : (
              heldCarts.map((h) => (
                <Pressable key={h.id} onPress={() => void resumeHeld(h)} className="mb-2 rounded-lg border border-app-border p-3">
                  <Text className="font-semibold text-app-text">{h.label ?? 'Held cart'}</Text>
                  <Text className="text-xs text-app-muted">{new Date(h.createdAt).toLocaleString()}</Text>
                </Pressable>
              ))
            )}
          </View>
        </Pressable>
      </Modal>

      <BarcodeScannerModal visible={showScanner} onClose={() => setShowScanner(false)} onScan={(b) => void handleBarcodeScan(b)} />
      <CustomerPickerModal visible={showCustomerPicker} selectedId={customerId} onClose={() => setShowCustomerPicker(false)} onSelect={(c) => { setCustomer(c.id); setCustomers((prev) => prev.some((x) => x.id === c.id) ? prev : [...prev, c]); }} />
    </ScreenContainer>
  );
}
