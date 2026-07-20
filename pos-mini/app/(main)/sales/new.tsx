import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { BarcodeScannerModal } from '../../../src/components/BarcodeScannerModal';
import { CategoryFilterTabs } from '../../../src/components/CategoryFilterTabs';
import { CustomerPickerModal } from '../../../src/components/CustomerPickerModal';
import { EmptyState } from '../../../src/components/EmptyState';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { ManagerApprovalModal } from '../../../src/components/ManagerApprovalModal';
import { NumericKeypad } from '../../../src/components/NumericKeypad';
import { ProductCard } from '../../../src/components/ProductCard';
import { SearchBar } from '../../../src/components/SearchBar';
import { SwipeableCartItem } from '../../../src/components/SwipeableCartItem';
import { VariantPickerModal } from '../../../src/components/VariantPickerModal';
import { ModifierPickerModal } from '../../../src/components/ModifierPickerModal';
import { findBestDiscountRule, listDiscountRules } from '../../../src/repositories/discountRepository';
import { listCategories } from '../../../src/repositories/categoryRepository';
import { listCustomers } from '../../../src/repositories/customerRepository';
import { deleteHeldCart, listHeldCarts, saveHeldCart } from '../../../src/repositories/heldCartRepository';
import {
  getPaymentMethodSettings,
  getPinnedProductIds,
  getPosSettings,
  getPrinterSettings,
  getRequireShift,
  type PaymentMethodSettings,
} from '../../../src/repositories/metaRepository';
import { listProductModifierGroups } from '../../../src/repositories/modifierRepository';
import { listVariantsByProduct } from '../../../src/repositories/variantRepository';
import { findProductByScaleCode, getProductByBarcode, listProducts, searchProducts } from '../../../src/repositories/productRepository';
import { createSale, getPendingSaleByTableId, savePendingTableSale } from '../../../src/repositories/saleRepository';
import { getTableById } from '../../../src/repositories/tableRepository';
import { isBundleProduct } from '../../../src/repositories/bundleRepository';
import { getOpenShift } from '../../../src/repositories/shiftRepository';
import { staffCount } from '../../../src/repositories/staffRepository';
import { printReceipt } from '../../../src/printing/PrinterService';
import type { Category, CartItem, Customer, DiscountMode, DiscountType, HeldCart, ModifierGroup, PaymentMethod, PosTable, Product, ProductVariant, SalePaymentInput, SelectedModifier } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { useCartStore } from '../../../src/store/cartStore';
import { parseScaleBarcode } from '../../../src/utils/barcode';
import { buildCartLineKey } from '../../../src/utils/cartLineKey';
import { getChipStyles } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useTheme';
import { useBusinessFeatures } from '../../../src/hooks/useBusinessFeatures';
import { formatMoney } from '../../../src/utils/currency';
import { roundMoney } from '../../../src/utils/calculations';
import { discountNeedsApproval } from '../../../src/utils/permissions';

function buildPaymentMethods(prefs: PaymentMethodSettings): { method: SalePaymentInput['paymentMethod']; label: string }[] {
  const list: { method: SalePaymentInput['paymentMethod']; label: string }[] = [{ method: 'cash', label: 'Cash' }];
  if (prefs.cardEnabled) list.push({ method: 'card', label: 'Card' });
  if (prefs.mobileEnabled) list.push({ method: 'mobile', label: prefs.mobileMoneyLabel || 'Mobile' });
  if (prefs.creditEnabled) list.push({ method: 'credit', label: 'Credit' });
  return list;
}

export default function NewSaleScreen() {
  const router = useRouter();
  const { tableId: tableIdParam } = useLocalSearchParams<{ tableId?: string }>();
  const tableId = typeof tableIdParam === 'string' ? tableIdParam : null;
  const { t } = useTranslation();
  const { cardStyle, colors } = useThemedStyles();
  const { hasModifiers, hasTableService } = useBusinessFeatures();
  const insets = useSafeAreaInsets();
  const chipStyle = (selected: boolean) => getChipStyles(colors, selected);
  const settings = useAppStore((s) => s.settings);
  const currentStaff = useAppStore((s) => s.currentStaff);
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
    tipAmount,
    serviceCharge,
    setTipAmount,
    setServiceCharge,
    getTotals,
    toSaleItems,
    getSnapshot,
    loadSnapshot,
    clear,
    tableId: cartTableId,
    pendingSaleId,
    setTableContext,
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
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [pendingVariants, setPendingVariants] = useState<ProductVariant[]>([]);
  const [pendingModifierGroups, setPendingModifierGroups] = useState<ModifierGroup[]>([]);
  const [pendingAdd, setPendingAdd] = useState<{
    product: Product;
    qty: number;
    unitPrice?: number;
    variant?: ProductVariant;
  } | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [discountThreshold, setDiscountThreshold] = useState(10);
  const [staffExists, setStaffExists] = useState(false);
  const [showManagerApproval, setShowManagerApproval] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<'manual-discount' | 'complete-sale' | null>(null);
  const [tipInput, setTipInput] = useState('');
  const [serviceInput, setServiceInput] = useState('');
  const [activeTable, setActiveTable] = useState<PosTable | null>(null);
  const totals = getTotals();

  useFocusEffect(
    useCallback(() => {
      void ScreenOrientation.unlockAsync();
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, []),
  );

  const loadTableBill = useCallback(
    async (tid: string) => {
      const [table, pending, allProducts] = await Promise.all([
        getTableById(tid),
        getPendingSaleByTableId(tid),
        listProducts(),
      ]);
      setActiveTable(table);
      setTableContext(tid, pending?.id ?? null);
      if (!pending?.items?.length) return;

      const cartItems: CartItem[] = pending.items.map((si) => {
        const product = allProducts.find((p) => p.id === si.productId);
        const modifiers: SelectedModifier[] | undefined = si.modifiersJson
          ? JSON.parse(si.modifiersJson)
          : undefined;
        return {
          lineKey: buildCartLineKey(si.productId, si.variantId ?? null, modifiers),
          productId: si.productId,
          productName: si.productName,
          variantId: si.variantId ?? null,
          variantName: si.variantName ?? null,
          modifiers,
          unitPrice: si.unitPrice,
          costPrice: si.costPrice,
          quantity: si.quantity,
          discountAmount: si.discountAmount,
          unit: product?.unit ?? 'pcs',
          taxClass: product?.taxClass ?? (product?.isTaxable ? 'B' : 'A'),
          isTaxable: product?.isTaxable ?? false,
          taxRate: product?.taxRate ?? 0,
          taxInclusive: product?.taxInclusive ?? false,
          trackStock: product?.trackStock ?? false,
          stockQty: product?.stockQty ?? 0,
          imageUri: product?.imageUri ?? null,
        };
      });

      loadSnapshot({
        items: cartItems,
        customerId: pending.customerId,
        discountMode:
          pending.discountPercent > 0 ? 'rule' : pending.discountAmount > 0 ? 'manual' : 'off',
        discountPercent: pending.discountPercent,
        fixedDiscount: pending.discountAmount,
        manualDiscountType: 'fixed',
        manualDiscountValue: pending.discountAmount,
        notes: pending.notes ?? '',
        tipAmount: pending.tipAmount ?? 0,
        serviceCharge: pending.serviceCharge ?? 0,
        tableId: tid,
        pendingSaleId: pending.id,
      });
      setTipInput(String(pending.tipAmount ?? 0));
      setServiceInput(String(pending.serviceCharge ?? 0));
    },
    [loadSnapshot, setTableContext],
  );

  useFocusEffect(
    useCallback(() => {
      if (!tableId || !hasTableService) return;
      void loadTableBill(tableId);
    }, [tableId, hasTableService, loadTableBill]),
  );

  const openCheckout = useCallback(() => {
    if (!items.length) {
      Toast.show({ type: 'error', text1: t('sales.emptyCart') });
      return;
    }
    const nextTotal = getTotals().total;
    setPayInput(String(nextTotal));
    setAmountPaid(nextTotal);
    setShowPay(true);
  }, [getTotals, items.length, setAmountPaid, t]);

  useEffect(() => {
    if (!showPay || splitEnabled || paymentMethod === 'credit') return;
    setPayInput(String(totals.total));
    setAmountPaid(totals.total);
  }, [showPay, totals.total, splitEnabled, paymentMethod, setAmountPaid]);

  const paymentMethods = useMemo(
    () => buildPaymentMethods(paymentPrefs ?? { cardEnabled: true, mobileEnabled: true, creditEnabled: true, mobileMoneyLabel: 'Mobile' }),
    [paymentPrefs],
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [list, custs, cats, prefs, pinned, pos, count] = await Promise.all([
          query ? searchProducts(query) : listProducts(),
          listCustomers(),
          listCategories(),
          getPaymentMethodSettings(),
          getPinnedProductIds(),
          getPosSettings(),
          staffCount(),
        ]);
        setProducts(list);
        setCustomers(custs);
        setCategories(cats);
        setPaymentPrefs(prefs);
        setPinnedIds(pinned);
        setDiscountThreshold(pos.managerDiscountThresholdPercent);
        setStaffExists(count > 0);
      })();
    }, [query]),
  );

  const filteredProducts = useMemo(() => {
    if (!categoryId) return products;
    return products.filter((p) => p.categoryId === categoryId);
  }, [products, categoryId]);

  const quickKeyProducts = useMemo(
    () => pinnedIds.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)),
    [pinnedIds, products],
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const splitPaidTotal = useMemo(
    () => roundMoney(splitPayments.reduce((s, p) => s + p.amount, 0)),
    [splitPayments],
  );

  const finalizeAddToCart = (
    product: Product,
    qty: number,
    unitPrice: number | undefined,
    variant: ProductVariant | undefined,
    modifiers: SelectedModifier[],
    modifierPriceDelta: number,
  ) => {
    const stockQty = variant?.stockQty ?? product.stockQty;
    const basePrice = unitPrice ?? variant?.sellPrice ?? product.sellPrice;
    const price = basePrice + modifierPriceDelta;

    if (product.trackStock && stockQty <= 0) {
      Toast.show({ type: 'error', text1: 'Out of stock' });
      return;
    }

    const existing = items.find(
      (i) =>
        i.productId === product.id &&
        (i.variantId ?? null) === (variant?.id ?? null) &&
        JSON.stringify(i.modifiers ?? []) === JSON.stringify(modifiers),
    );
    const nextQty = (existing?.quantity ?? 0) + qty;
    if (product.trackStock && nextQty > stockQty) {
      Toast.show({ type: 'error', text1: 'Not enough stock' });
      return;
    }

    const displayName = variant ? `${product.name} (${variant.name})` : product.name;

    addItem({
      productId: product.id,
      productName: displayName,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      modifiers: modifiers.length ? modifiers : undefined,
      unitPrice: price,
      costPrice: variant?.costPrice ?? product.costPrice,
      unit: product.unit,
      taxClass: product.taxClass,
      isTaxable: product.isTaxable,
      taxRate: product.taxRate,
      taxInclusive: product.taxInclusive ?? false,
      trackStock: product.trackStock,
      stockQty,
      imageUri: product.imageUri,
      quantity: qty,
    });
  };

  const continueAddProduct = async (
    product: Product,
    qty = 1,
    unitPrice?: number,
    variant?: ProductVariant,
  ) => {
    const modifierGroups = hasModifiers ? await listProductModifierGroups(product.id) : [];
    if (modifierGroups.length > 0) {
      setPendingAdd({ product, qty, unitPrice, variant });
      setPendingModifierGroups(modifierGroups);
      setShowModifierPicker(true);
      return;
    }
    finalizeAddToCart(product, qty, unitPrice, variant, [], 0);
  };

  const beginAddProduct = async (product: Product, qty = 1, unitPrice?: number) => {
    if (await isBundleProduct(product.id)) {
      Toast.show({
        type: 'info',
        text1: 'Bundle product',
        text2: 'Sold as one line; stock deducts from components',
      });
    }
    const variants = await listVariantsByProduct(product.id);
    if (variants.length > 0) {
      setPendingAdd({ product, qty, unitPrice });
      setPendingVariants(variants);
      setShowVariantPicker(true);
      return;
    }
    await continueAddProduct(product, qty, unitPrice);
  };

  const addProduct = (product: Product, qty = 1, unitPrice?: number) => {
    void beginAddProduct(product, qty, unitPrice);
  };

  const setItemQuantity = (item: CartItem, qty: number) => {
    if (item.trackStock && qty > item.stockQty) {
      Toast.show({ type: 'error', text1: 'Not enough stock' });
      return;
    }
    updateQuantity(item.lineKey, qty);
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
    const subtotal = getTotals().subtotal;
    const amount =
      manualType === 'percent' ? roundMoney((subtotal * val) / 100) : roundMoney(val);
    if (
      discountNeedsApproval(subtotal, amount, discountThreshold, currentStaff, staffExists)
    ) {
      setPendingApproval('manual-discount');
      setShowManagerApproval(true);
      return;
    }
    setDiscountMode('manual');
    setManualDiscount(manualType, val);
    setShowManualDisc(false);
  };

  const finalizeManualDiscount = () => {
    const val = Number(manualValue) || 0;
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
      Toast.show({ type: 'error', text1: t('sales.emptyCart') });
      return;
    }

    const requireShift = await getRequireShift();
    const openShift = await getOpenShift();
    if (requireShift && !openShift) {
      Toast.show({
        type: 'error',
        text1: t('sales.noOpenShift'),
        text2: t('sales.openShiftHint'),
        onPress: () => router.push('/(main)/settings/shift'),
      });
      return;
    }

    if (
      totals.discountAmount > 0 &&
      discountNeedsApproval(
        totals.subtotal,
        totals.discountAmount,
        discountThreshold,
        currentStaff,
        staffExists,
      )
    ) {
      setPendingApproval('complete-sale');
      setShowManagerApproval(true);
      return;
    }

    await runCompleteSale();
  };

  const runCompleteSale = async () => {
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

    const creditAmount = splitEnabled
      ? splitPayments.filter((p) => p.paymentMethod === 'credit').reduce((s, p) => s + p.amount, 0)
      : paymentMethod === 'credit'
        ? totals.total
        : 0;

    if (creditAmount > 0 && selectedCustomer) {
      const projectedDebt = selectedCustomer.totalDebt + creditAmount;
      if (selectedCustomer.creditLimit > 0 && projectedDebt > selectedCustomer.creditLimit) {
        Toast.show({
          type: 'error',
          text1: 'Credit limit exceeded',
          text2: `Limit ${formatMoney(selectedCustomer.creditLimit, settings)} · debt would be ${formatMoney(projectedDebt, settings)}`,
        });
        return;
      }
      if (
        selectedCustomer.creditLimit > 0 &&
        projectedDebt > selectedCustomer.creditLimit * 0.85
      ) {
        Toast.show({
          type: 'info',
          text1: 'Near credit limit',
          text2: `${formatMoney(selectedCustomer.creditLimit - projectedDebt, settings)} remaining`,
        });
      }
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
        tipAmount: totals.tipAmount,
        serviceCharge: totals.serviceCharge,
        total: totals.total,
        amountPaid: paid,
        changeAmount: splitEnabled ? Math.max(0, paid - totals.total) : paymentMethod === 'credit' ? 0 : Math.max(0, paid - totals.total),
        paymentMethod: splitEnabled ? 'split' : paymentMethod,
        notes: notes.trim() || null,
        payments: splitEnabled ? splitPayments : undefined,
        tableId: tableId ?? cartTableId ?? null,
        existingSaleId: pendingSaleId ?? null,
        status: 'completed',
      });
      clear();
      setTipInput('');
      setServiceInput('');
      await refreshStats();

      const printer = await getPrinterSettings();
      if (printer.autoPrint && settings) {
        try {
          await printReceipt(sale, sale.items ?? [], settings);
        } catch {
          // non-blocking
        }
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Sale completed', text2: sale.invoiceNumber });
      router.replace(`/(main)/sales/${sale.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sale failed';
      if (msg === 'NO_OPEN_SHIFT') {
        Toast.show({
          type: 'error',
          text1: t('sales.noOpenShift'),
          text2: t('sales.openShiftHint'),
          onPress: () => router.push('/(main)/settings/shift'),
        });
        return;
      }
      Toast.show({ type: 'error', text1: msg });
    }
  };

  const saveTableBill = async () => {
    const tid = tableId ?? cartTableId;
    if (!tid) return;
    if (!items.length) {
      Toast.show({ type: 'error', text1: 'Add items first' });
      return;
    }
    try {
      await savePendingTableSale(tid, {
        customerId: customerId ?? null,
        items: toSaleItems(),
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        discountPercent,
        taxAmount: totals.taxAmount,
        tipAmount: totals.tipAmount,
        serviceCharge: totals.serviceCharge,
        total: totals.total,
        notes: notes.trim() || null,
      });
      clear();
      Toast.show({ type: 'success', text1: 'Bill saved to table' });
      router.back();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const tableBanner =
    activeTable && (tableId ?? cartTableId) ? (
      <View
        style={[cardStyle, { borderColor: colors.warning, backgroundColor: colors.primarySoft }]}
        className="mb-3 flex-row items-center justify-between p-3"
      >
        <View>
          <Text className="text-xs font-semibold uppercase text-app-muted">Table</Text>
          <Text className="font-semibold text-app-text">{activeTable.name}</Text>
        </View>
        <Pressable onPress={() => router.back()} className="rounded-lg border border-app-border bg-app-surface px-3 py-2">
          <Text className="text-sm font-medium text-app-text">Back</Text>
        </Pressable>
      </View>
    ) : null;

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
        {tableBanner}
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

        <View className="mb-3 flex-row gap-2">
          <View className="flex-1">
            <FormField
              label="Tip"
              value={tipInput}
              onChangeText={(v) => {
                setTipInput(v);
                setTipAmount(Number(v) || 0);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
          <View className="flex-1">
            <FormField
              label="Service charge"
              value={serviceInput}
              onChangeText={(v) => {
                setServiceInput(v);
                setServiceCharge(Number(v) || 0);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </View>
        </View>
        {(tipAmount > 0 || serviceCharge > 0) ? (
          <Text className="mb-3 text-sm text-app-muted">
            Adjusted total: {formatMoney(totals.total, settings)}
          </Text>
        ) : null}

        <Pressable onPress={() => void completeSale()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold text-white">{t('sales.complete')}</Text>
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
        {quickKeyProducts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            {quickKeyProducts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => addProduct(p)}
                className="mr-2 rounded-lg border border-app-primary bg-app-primary-soft px-3 py-2"
              >
                <Text className="text-sm font-semibold text-app-text" numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
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
        {tableBanner}
        {customerBanner}
        {discountChip}
        <View className="mb-2 min-h-0 flex-1">
          {items.length > 0 ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
              {items.map((item) => (
                <SwipeableCartItem
                  key={item.lineKey}
                  item={item}
                  onIncrease={() => updateQuantity(item.lineKey, item.quantity + 1)}
                  onDecrease={() => updateQuantity(item.lineKey, item.quantity - 1)}
                  onRemove={() => removeItem(item.lineKey)}
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
        <View
          className="border-t border-app-border pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          <View className="flex-row flex-wrap gap-2">
          <Pressable onPress={openCheckout} className="flex-1 min-w-[120px] rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold text-white">{t('sales.checkout')}</Text>
          </Pressable>
          {tableId ?? cartTableId ? (
            <Pressable onPress={() => void saveTableBill()} className="rounded-xl border border-app-border bg-app-surface px-3 py-3">
              <Text className="font-semibold text-app-text">Save table</Text>
            </Pressable>
          ) : null}
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

      <VariantPickerModal
        visible={showVariantPicker}
        productName={pendingAdd?.product.name ?? ''}
        variants={pendingVariants}
        onSelect={(variant) => {
          setShowVariantPicker(false);
          if (pendingAdd) {
            void continueAddProduct(pendingAdd.product, pendingAdd.qty, pendingAdd.unitPrice, variant);
          }
          setPendingVariants([]);
        }}
        onCancel={() => {
          setShowVariantPicker(false);
          setPendingAdd(null);
          setPendingVariants([]);
        }}
      />

      <ModifierPickerModal
        visible={showModifierPicker}
        productName={pendingAdd?.product.name ?? ''}
        groups={pendingModifierGroups}
        onConfirm={(modifiers, priceDelta) => {
          setShowModifierPicker(false);
          if (pendingAdd) {
            finalizeAddToCart(
              pendingAdd.product,
              pendingAdd.qty,
              pendingAdd.unitPrice,
              pendingAdd.variant,
              modifiers,
              priceDelta,
            );
          }
          setPendingAdd(null);
          setPendingModifierGroups([]);
        }}
        onCancel={() => {
          setShowModifierPicker(false);
          setPendingAdd(null);
          setPendingModifierGroups([]);
        }}
      />

      <ManagerApprovalModal
        visible={showManagerApproval}
        title="Manager approval required"
        message="A manager PIN is required for this discount or void-level action."
        onApproved={() => {
          setShowManagerApproval(false);
          if (pendingApproval === 'manual-discount') finalizeManualDiscount();
          else if (pendingApproval === 'complete-sale') void runCompleteSale();
          setPendingApproval(null);
        }}
        onCancel={() => {
          setShowManagerApproval(false);
          setPendingApproval(null);
        }}
      />
    </ScreenContainer>
  );
}
