import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import * as Print from 'expo-print';
import Toast from 'react-native-toast-message';
import { ConfirmModal } from '../../../src/components/ConfirmModal';
import { ReceiptView } from '../../../src/components/ReceiptView';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { getReceiptDisplayPrefs } from '../../../src/repositories/metaRepository';
import { getCurrentStaffId } from '../../../src/repositories/metaRepository';
import { getProductById } from '../../../src/repositories/productRepository';
import { getStaffById, staffCount } from '../../../src/repositories/staffRepository';
import { getSaleWithItems, voidSale } from '../../../src/repositories/saleRepository';
import { printReceipt, savedPrinterAddress } from '../../../src/printing/PrinterService';
import type { Sale, SaleItem } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { useThemeColors } from '../../../src/hooks/useTheme';
import { buildReceiptHtml, buildReceiptText } from '../../../src/utils/receipt';

export default function SaleDetailScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const refreshStats = useAppStore((s) => s.refreshStats);
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [barcodes, setBarcodes] = useState<Record<string, string | null>>({});
  const [hasPrinter, setHasPrinter] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [canVoid, setCanVoid] = useState(true);

  const load = useCallback(async () => {
    if (!saleId) return;
    const s = await getSaleWithItems(saleId);
    if (!s) return;
    setSale(s);
    setItems(s.items ?? []);
    const map: Record<string, string | null> = {};
    for (const item of s.items ?? []) {
      const p = await getProductById(item.productId);
      map[item.productId] = p?.barcode ?? null;
    }
    setBarcodes(map);
    const staffId = await getCurrentStaffId();
    const count = await staffCount();
    if (count === 0) {
      setCanVoid(true);
    } else if (staffId) {
      const staff = await getStaffById(staffId);
      setCanVoid(staff?.role === 'manager');
    } else {
      setCanVoid(false);
    }
  }, [saleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void savedPrinterAddress().then((addr) => setHasPrinter(Boolean(addr)));
    }, [load]),
  );

  const getReceiptBody = async () => {
    if (!sale || !settings) return '';
    const display = await getReceiptDisplayPrefs();
    return buildReceiptText(sale, items, settings, display, barcodes);
  };

  const printBluetooth = async () => {
    if (!sale || !settings) return;
    try {
      const result = await printReceipt(sale, items, settings);
      Toast.show({ type: 'success', text1: result.simulated ? 'Print simulated' : 'Sent to printer' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Print failed' });
    }
  };

  const shareHtml = async () => {
    if (!sale || !settings) return;
    try {
      const display = await getReceiptDisplayPrefs();
      const html = buildReceiptHtml(sale, items, settings, display, barcodes);
      await Print.printAsync({ html });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Share failed' });
    }
  };

  const shareSms = async () => {
    const body = encodeURIComponent(await getReceiptBody());
    await Linking.openURL(`sms:?body=${body}`);
  };

  const shareEmail = async () => {
    const body = encodeURIComponent(await getReceiptBody());
    const subject = encodeURIComponent(`Receipt ${sale?.invoiceNumber ?? ''}`);
    await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  };

  const doVoid = async () => {
    if (!saleId || !canVoid) {
      Toast.show({ type: 'error', text1: 'Manager role required to void sales' });
      setConfirmVoid(false);
      return;
    }
    try {
      await voidSale(saleId);
      await refreshStats();
      setConfirmVoid(false);
      await load();
      Toast.show({ type: 'success', text1: 'Sale voided' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Void failed' });
    }
  };

  if (!sale) {
    return (
      <ScreenContainer>
        <Text className="text-app-text">Loading...</Text>
      </ScreenContainer>
    );
  }

  const canRefund = sale.status === 'completed' && sale.refundStatus !== 'refunded';

  return (
    <ScreenContainer padded={false} style={{ flex: 1 }}>
      <View className="min-h-0 flex-1 px-4 pt-2">
        {sale.status === 'voided' ? (
          <Text className="mb-2 text-center font-bold text-app-danger">VOIDED</Text>
        ) : null}
        {sale.refundStatus === 'refunded' ? (
          <View className="mb-2 items-center">
            <StatusBadge label="Refunded" tone="warning" />
          </View>
        ) : sale.refundStatus === 'partial' ? (
          <View className="mb-2 items-center">
            <StatusBadge label="Partially refunded" tone="warning" />
          </View>
        ) : null}
        <View className="min-h-0 flex-1">
          <ReceiptView sale={sale} items={items} barcodes={barcodes} />
        </View>
        <View
          className="mt-3 border-t border-app-border pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          <View className="flex-row flex-wrap gap-2">
            {hasPrinter ? (
              <Pressable onPress={() => void printBluetooth()} className="flex-1 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
                <Text className="text-center font-semibold text-white">Print</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => void shareHtml()} className="flex-1 rounded-xl border border-app-border bg-app-surface py-3">
              <Text className="text-center font-semibold text-app-text">Share</Text>
            </Pressable>
            <Pressable onPress={() => void shareSms()} className="flex-1 rounded-xl border border-app-border bg-app-surface py-3">
              <Text className="text-center font-semibold text-app-text">SMS</Text>
            </Pressable>
            <Pressable onPress={() => void shareEmail()} className="flex-1 rounded-xl border border-app-border bg-app-surface py-3">
              <Text className="text-center font-semibold text-app-text">Email</Text>
            </Pressable>
          </View>
        {canRefund ? (
          <Pressable
            onPress={() => router.push({ pathname: '/(main)/refunds/new', params: { saleId: sale.id } })}
            className="mt-3 rounded-xl border border-app-border bg-app-surface py-3"
          >
            <Text className="text-center font-semibold text-app-danger">Process refund</Text>
          </Pressable>
        ) : null}
        {sale.status === 'completed' && canVoid ? (
          <Pressable onPress={() => setConfirmVoid(true)} className="mt-3 rounded-xl border border-app-danger py-3">
            <Text className="text-center font-semibold text-app-danger">Void sale</Text>
          </Pressable>
        ) : null}
        </View>
      </View>
      <ConfirmModal
        visible={confirmVoid}
        title="Void this sale?"
        message="Stock will be restored. Credit debt will be reversed if applicable."
        destructive
        onConfirm={() => void doVoid()}
        onCancel={() => setConfirmVoid(false)}
      />
    </ScreenContainer>
  );
}
