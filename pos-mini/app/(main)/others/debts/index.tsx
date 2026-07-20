import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { KeyboardFormScroll } from '../../../../src/components/KeyboardFormScroll';
import { ScreenContainer, ScreenList } from '../../../../src/components/ScreenContainer';
import Toast from 'react-native-toast-message';
import { NumericKeypad } from '../../../../src/components/NumericKeypad';
import { PaginatedFlashList } from '../../../../src/components/PaginatedFlashList';
import { listCustomerDebts, recordDebtPayment } from '../../../../src/repositories/discountRepository';
import { recordPurchasePayment } from '../../../../src/repositories/purchaseRepository';
import { listCustomers } from '../../../../src/repositories/customerRepository';
import type { Customer, DebtRecord } from '../../../../src/types';
import { useAppStore } from '../../../../src/store/appStore';
import { useThemedStyles } from '../../../../src/hooks/useTheme';
import { formatMoney } from '../../../../src/utils/currency';
import { getCustomersWithDebtPaginated, getUnpaidPurchasesPaginated } from '../../../../src/utils/reports';

type UnpaidPurchase = {
  id: string;
  poNumber: string;
  supplierName: string | null;
  balance: number;
};

const PAGE_SIZE = 15;

export default function DebtsScreen() {
  const { cardStyle, colors } = useThemedStyles();
  const settings = useAppStore((s) => s.settings);
  const [customersWithDebt, setCustomersWithDebt] = useState<{ id: string; name: string; totalDebt: number }[]>([]);
  const [customerDebtTotal, setCustomerDebtTotal] = useState(0);
  const [customerDebtHasMore, setCustomerDebtHasMore] = useState(false);
  const [customerDebtLoading, setCustomerDebtLoading] = useState(false);
  const [unpaidPurchases, setUnpaidPurchases] = useState<UnpaidPurchase[]>([]);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [unpaidHasMore, setUnpaidHasMore] = useState(false);
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<UnpaidPurchase | null>(null);
  const [debtHistory, setDebtHistory] = useState<DebtRecord[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showPoPayment, setShowPoPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const loadCustomerDebts = useCallback(async (offset = 0, append = false) => {
    const page = await getCustomersWithDebtPaginated({ limit: PAGE_SIZE, offset });
    setCustomersWithDebt((prev) => (append ? [...prev, ...page.items] : page.items));
    setCustomerDebtTotal(page.total);
    setCustomerDebtHasMore(page.hasMore);
  }, []);

  const loadUnpaid = useCallback(async (offset = 0, append = false) => {
    const page = await getUnpaidPurchasesPaginated({ limit: PAGE_SIZE, offset });
    setUnpaidPurchases((prev) => (append ? [...prev, ...page.items] : page.items));
    setUnpaidTotal(page.total);
    setUnpaidHasMore(page.hasMore);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCustomerDebts(0, false);
      void loadUnpaid(0, false);
    }, [loadCustomerDebts, loadUnpaid]),
  );

  const loadMoreCustomerDebts = async () => {
    if (!customerDebtHasMore || customerDebtLoading) return;
    setCustomerDebtLoading(true);
    await loadCustomerDebts(customersWithDebt.length, true);
    setCustomerDebtLoading(false);
  };

  const loadMoreUnpaid = async () => {
    if (!unpaidHasMore || unpaidLoading) return;
    setUnpaidLoading(true);
    await loadUnpaid(unpaidPurchases.length, true);
    setUnpaidLoading(false);
  };

  const loadMoreAll = async () => {
    if (customerDebtHasMore) {
      await loadMoreCustomerDebts();
      return;
    }
    if (unpaidHasMore) {
      await loadMoreUnpaid();
    }
  };

  const selectCustomer = async (id: string) => {
    const all = await listCustomers();
    const customer = all.find((c) => c.id === id) ?? null;
    setSelectedCustomer(customer);
    if (customer) setDebtHistory(await listCustomerDebts(customer.id));
  };

  const recordPayment = async () => {
    if (!selectedCustomer) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' });
      return;
    }
    try {
      await recordDebtPayment(selectedCustomer.id, amount, payNotes || null);
      Toast.show({ type: 'success', text1: 'Payment recorded' });
      setShowPayment(false);
      setPayAmount('');
      setPayNotes('');
      await loadCustomerDebts(0, false);
      const all = await listCustomers();
      const updated = all.find((c) => c.id === selectedCustomer.id);
      setSelectedCustomer(updated ?? null);
      if (updated) setDebtHistory(await listCustomerDebts(updated.id));
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Payment failed' });
    }
  };

  const recordPoPayment = async () => {
    if (!selectedPurchase) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' });
      return;
    }
    try {
      await recordPurchasePayment(selectedPurchase.id, amount, payNotes || null);
      Toast.show({ type: 'success', text1: 'Payment recorded' });
      setShowPoPayment(false);
      setSelectedPurchase(null);
      setPayAmount('');
      setPayNotes('');
      await loadUnpaid(0, false);
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Payment failed' });
    }
  };

  if (showPoPayment && selectedPurchase) {
    return (
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text className="mb-2 text-xl font-bold text-app-text">Record PO payment</Text>
        <Text className="mb-1 font-bold text-app-text">{selectedPurchase.poNumber}</Text>
        <Text className="mb-4 text-app-muted">Balance: {formatMoney(selectedPurchase.balance, settings)}</Text>
        <NumericKeypad value={payAmount} onChange={setPayAmount} />
        <TextInput value={payNotes} onChangeText={setPayNotes} placeholder="Notes (optional)" className="mt-3 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text" />
        <Pressable onPress={() => void recordPoPayment()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-bold text-white">Save payment</Text>
        </Pressable>
        <Pressable onPress={() => { setShowPoPayment(false); setSelectedPurchase(null); }} className="mt-2 rounded-xl border border-app-border py-3">
          <Text className="text-center font-bold text-app-text">Cancel</Text>
        </Pressable>
      </KeyboardFormScroll>
    );
  }

  if (showPayment && selectedCustomer) {
    return (
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text className="mb-2 text-xl font-bold text-app-text">Record payment</Text>
        <Text className="mb-4 text-app-muted">
          {selectedCustomer.name} — owes {formatMoney(selectedCustomer.totalDebt, settings)}
        </Text>
        <NumericKeypad value={payAmount} onChange={setPayAmount} />
        <TextInput value={payNotes} onChangeText={setPayNotes} placeholder="Notes (optional)" className="mt-3 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text" />
        <Pressable onPress={() => void recordPayment()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-bold text-white">Save payment</Text>
        </Pressable>
        <Pressable onPress={() => setShowPayment(false)} className="mt-2 rounded-xl border border-app-border py-3">
          <Text className="text-center font-bold text-app-text">Cancel</Text>
        </Pressable>
      </KeyboardFormScroll>
    );
  }

  if (selectedCustomer) {
    return (
      <ScreenContainer scroll>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-app-text">{selectedCustomer.name}</Text>
          <Pressable onPress={() => setSelectedCustomer(null)} className="rounded border border-app-border px-2 py-1">
            <Text className="text-sm font-bold text-app-text">Back</Text>
          </Pressable>
        </View>
        <Text className="mb-4 text-lg font-bold text-app-danger">
          Balance: {formatMoney(selectedCustomer.totalDebt, settings)}
        </Text>
        {selectedCustomer.totalDebt > 0 ? (
          <Pressable onPress={() => setShowPayment(true)} className="mb-4 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-bold text-white">Record payment</Text>
          </Pressable>
        ) : null}
        <Text className="mb-2 font-bold text-app-text">History</Text>
        {debtHistory.map((d) => (
          <View key={d.id} style={cardStyle} className="mb-2 p-3">
            <View className="flex-row justify-between">
              <Text className="font-bold capitalize text-app-text">{d.type}</Text>
              <Text className="font-bold text-app-text">{formatMoney(d.amount, settings)}</Text>
            </View>
            <Text className="text-xs text-app-muted">{new Date(d.createdAt).toLocaleString()}</Text>
          </View>
        ))}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false} style={{ flex: 1 }}>
      <View className="px-4 pt-4">
        <Text className="mb-1 font-bold text-app-text">Debt management</Text>
        <Text className="mb-3 text-sm text-app-muted">
          Customer debts are created when you complete a sale with Credit payment and an attached customer.
          Enable Credit under Settings → Payment methods, then use New Sale → attach customer → Credit.
        </Text>
      </View>
      <Text className="px-4 font-bold text-app-text">Customer debts ({customerDebtTotal})</Text>
      <ScreenList inset>
        <PaginatedFlashList
          data={customersWithDebt}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => void selectCustomer(item.id)} style={cardStyle} className="mb-2 mt-2 p-3">
              <View className="flex-row justify-between">
                <Text className="font-bold text-app-text">{item.name}</Text>
                <Text className="font-bold text-app-danger">{formatMoney(item.totalDebt, settings)}</Text>
              </View>
            </Pressable>
          )}
          loading={false}
          loadingMore={customerDebtLoading || unpaidLoading}
          refreshing={false}
          onRefresh={() => {
            void loadCustomerDebts(0, false);
            void loadUnpaid(0, false);
          }}
          onLoadMore={() => void loadMoreAll()}
          hasMore={customerDebtHasMore || unpaidHasMore}
          emptyTitle="No outstanding debts"
          emptyMessage="Record a credit sale with a customer attached, or record a payment when a customer pays their balance."
          ListFooterComponent={
            <View className="px-4 pb-4">
              <Text className="mb-3 mt-4 font-bold text-app-text">Unpaid purchases ({unpaidTotal})</Text>
              {unpaidPurchases.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setSelectedPurchase(p);
                    setPayAmount('');
                    setPayNotes('');
                    setShowPoPayment(true);
                  }}
                  style={cardStyle}
                  className="mb-2 p-3"
                >
                  <View className="flex-row justify-between">
                    <Text className="font-bold text-app-text">{p.poNumber}</Text>
                    <Text className="font-bold text-app-danger">{formatMoney(p.balance, settings)}</Text>
                  </View>
                  {p.supplierName ? <Text className="text-sm text-app-muted">{p.supplierName}</Text> : null}
                </Pressable>
              ))}
            </View>
          }
        />
      </ScreenList>
    </ScreenContainer>
  );
}
