import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer, ScreenList } from '../../../../src/components/ScreenContainer';
import Toast from 'react-native-toast-message';
import { EntityFormModal, type EntityFormValues } from '../../../../src/components/EntityFormModal';
import { ListCard } from '../../../../src/components/ListCard';
import { PaginatedFlashList } from '../../../../src/components/PaginatedFlashList';
import { StatusBadge } from '../../../../src/components/StatusBadge';
import { listCustomerDebts } from '../../../../src/repositories/discountRepository';
import { getCustomerById, updateCustomer } from '../../../../src/repositories/customerRepository';
import { listSalesPaginated } from '../../../../src/repositories/saleRepository';
import type { Customer, DebtRecord, Sale } from '../../../../src/types';
import { useAppStore } from '../../../../src/store/appStore';
import { useThemedStyles } from '../../../../src/hooks/useTheme';
import { formatMoney } from '../../../../src/utils/currency';

const emptyForm: EntityFormValues = { name: '', phone: '', email: '', address: '', notes: '' };

export default function CustomerDetailScreen() {
  const { cardStyle, colors } = useThemedStyles();
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const settings = useAppStore((s) => s.settings);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesOffset, setSalesOffset] = useState(0);
  const [salesHasMore, setSalesHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EntityFormValues>(emptyForm);

  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    const c = await getCustomerById(customerId);
    setCustomer(c);
    if (c) {
      setDebts(await listCustomerDebts(c.id));
      setForm({
        name: c.name,
        phone: c.phone ?? '',
        email: c.email ?? '',
        address: c.address ?? '',
        notes: c.notes ?? '',
      });
    }
  }, [customerId]);

  const loadSales = useCallback(async (offset = 0, append = false) => {
    if (!customerId) return;
    const page = await listSalesPaginated({ customerId, limit: 15, offset });
    setSales((prev) => (append ? [...prev, ...page.items] : page.items));
    setSalesTotal(page.total);
    setSalesHasMore(page.hasMore);
    setSalesOffset(offset + page.items.length);
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      void loadCustomer();
      void loadSales(0, false);
    }, [loadCustomer, loadSales]),
  );

  const loadMoreSales = async () => {
    if (!salesHasMore || loadingMore) return;
    setLoadingMore(true);
    await loadSales(salesOffset, true);
    setLoadingMore(false);
  };

  const openEdit = () => {
    if (!customer) return;
    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      notes: customer.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!customerId || !form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    try {
      const updated = await updateCustomer(customerId, {
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
      });
      setCustomer(updated);
      setEditOpen(false);
      Toast.show({ type: 'success', text1: 'Customer updated' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Update failed' });
    }
  };

  if (!customer) {
    return (
      <ScreenContainer>
        <Text className="text-app-muted">Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false} style={{ flex: 1 }}>
      <View className="border-b border-app-border px-4 py-4" style={cardStyle}>
        <Text className="text-xl font-bold text-app-text">{customer.name}</Text>
        {customer.phone ? <Text className="text-app-muted">{customer.phone}</Text> : null}
        {customer.email ? <Text className="text-app-muted">{customer.email}</Text> : null}
        {customer.address ? <Text className="text-app-muted">{customer.address}</Text> : null}
        {customer.totalDebt > 0 ? (
          <View className="mt-2">
            <StatusBadge label={`Owes ${formatMoney(customer.totalDebt, settings)}`} tone="warning" />
          </View>
        ) : null}
        <Pressable
          onPress={() => setEditOpen(true)}
          className="mt-3 self-start rounded-lg border border-app-border px-3 py-2"
        >
          <Text className="font-semibold text-app-text">Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(main)/others/debts')}
          className="mt-2 self-start rounded-lg px-3 py-2"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="font-semibold text-white">Manage debt</Text>
        </Pressable>
      </View>

      <Text className="px-4 pt-4 font-bold text-app-text">Purchase history ({salesTotal})</Text>
      <ScreenList>
      <PaginatedFlashList
        data={sales}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard onPress={() => router.push(`/(main)/sales/${item.id}`)}>
            <View className="flex-row justify-between">
              <Text className="font-bold text-app-text">{item.invoiceNumber}</Text>
              <Text className="font-bold text-app-text">{formatMoney(item.total, settings)}</Text>
            </View>
            <Text className="text-sm text-app-muted">{new Date(item.createdAt).toLocaleString()}</Text>
          </ListCard>
        )}
        loading={false}
        loadingMore={loadingMore}
        refreshing={false}
        onRefresh={() => void loadSales(0, false)}
        onLoadMore={() => void loadMoreSales()}
        hasMore={salesHasMore}
        emptyTitle="No sales"
        emptyMessage="This customer has no sales yet."
        ListFooterComponent={
          debts.length > 0 ? (
            <View className="px-4 pb-4">
              <Text className="mb-2 font-bold text-app-text">Debt history</Text>
              {debts.slice(0, 5).map((d) => (
                <View key={d.id} style={cardStyle} className="mb-2 p-3">
                  <View className="flex-row justify-between">
                    <Text className="capitalize text-app-text">{d.type}</Text>
                    <Text className="font-bold text-app-text">{formatMoney(d.amount, settings)}</Text>
                  </View>
                  <Text className="text-xs text-app-muted">{new Date(d.createdAt).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />
      </ScreenList>

      <EntityFormModal
        visible={editOpen}
        title="Edit customer"
        values={form}
        onChange={setForm}
        onSave={() => void saveEdit()}
        onCancel={() => setEditOpen(false)}
      />
    </ScreenContainer>
  );
}
