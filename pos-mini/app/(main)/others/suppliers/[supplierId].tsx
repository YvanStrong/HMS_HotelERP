import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer, ScreenList } from '../../../../src/components/ScreenContainer';
import Toast from 'react-native-toast-message';
import { EntityFormModal, type EntityFormValues } from '../../../../src/components/EntityFormModal';
import { ListCard } from '../../../../src/components/ListCard';
import { PaginatedFlashList } from '../../../../src/components/PaginatedFlashList';
import { getSupplierById, updateSupplier } from '../../../../src/repositories/supplierRepository';
import { listPurchasesPaginated } from '../../../../src/repositories/purchaseRepository';
import type { Purchase, Supplier } from '../../../../src/types';
import { useAppStore } from '../../../../src/store/appStore';
import { useCardStyle } from '../../../../src/hooks/useTheme';
import { formatMoney } from '../../../../src/utils/currency';

const emptyForm: EntityFormValues = { name: '', phone: '', email: '', address: '', notes: '' };

export default function SupplierDetailScreen() {
  const cardStyle = useCardStyle();
  const router = useRouter();
  const { supplierId } = useLocalSearchParams<{ supplierId: string }>();
  const settings = useAppStore((s) => s.settings);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EntityFormValues>(emptyForm);

  const loadSupplier = useCallback(async () => {
    if (!supplierId) return;
    const s = await getSupplierById(supplierId);
    setSupplier(s);
    if (s) {
      setForm({
        name: s.name,
        phone: s.phone ?? '',
        email: s.email ?? '',
        address: s.address ?? '',
        notes: s.notes ?? '',
      });
    }
  }, [supplierId]);

  const loadPurchases = useCallback(async (start = 0, append = false) => {
    if (!supplierId) return;
    const page = await listPurchasesPaginated({ supplierId, limit: 15, offset: start });
    setPurchases((prev) => (append ? [...prev, ...page.items] : page.items));
    setTotal(page.total);
    setHasMore(page.hasMore);
    setOffset(start + page.items.length);
  }, [supplierId]);

  useFocusEffect(
    useCallback(() => {
      void loadSupplier();
      void loadPurchases(0, false);
    }, [loadSupplier, loadPurchases]),
  );

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadPurchases(offset, true);
    setLoadingMore(false);
  };

  const saveEdit = async () => {
    if (!supplierId || !form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    await updateSupplier(supplierId, {
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    });
    setEditOpen(false);
    await loadSupplier();
    Toast.show({ type: 'success', text1: 'Supplier updated' });
  };

  if (!supplier) {
    return (
      <ScreenContainer>
        <Text className="text-app-muted">Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false} style={{ flex: 1 }}>
      <View className="border-b border-app-border px-4 py-4" style={cardStyle}>
        <Text className="text-xl font-bold text-app-text">{supplier.name}</Text>
        {supplier.phone ? <Text className="text-app-muted">{supplier.phone}</Text> : null}
        {supplier.email ? <Text className="text-app-muted">{supplier.email}</Text> : null}
        {supplier.address ? <Text className="text-app-muted">{supplier.address}</Text> : null}
        {supplier.notes ? <Text className="mt-2 text-sm text-app-muted">{supplier.notes}</Text> : null}
        <Pressable onPress={() => setEditOpen(true)} className="mt-3 self-start rounded-lg border border-app-border px-3 py-2">
          <Text className="font-semibold text-app-text">Edit</Text>
        </Pressable>
      </View>

      <Text className="px-4 pt-4 font-bold text-app-text">Purchase history ({total})</Text>
      <ScreenList>
      <PaginatedFlashList
        data={purchases}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard onPress={() => router.push(`/(main)/purchases/${item.id}`)}>
            <View className="flex-row justify-between">
              <Text className="font-bold text-app-text">{item.poNumber}</Text>
              <Text className="font-bold text-app-text">{formatMoney(item.total, settings)}</Text>
            </View>
            <Text className="text-sm text-app-muted">{new Date(item.createdAt).toLocaleString()}</Text>
            {item.total > item.amountPaid ? (
              <Text className="text-sm text-app-danger">
                Balance: {formatMoney(item.total - item.amountPaid, settings)}
              </Text>
            ) : null}
          </ListCard>
        )}
        loading={false}
        loadingMore={loadingMore}
        refreshing={false}
        onRefresh={() => void loadPurchases(0, false)}
        onLoadMore={() => void loadMore()}
        hasMore={hasMore}
        emptyTitle="No purchases"
        emptyMessage="No purchase orders from this supplier."
      />
      </ScreenList>
      <EntityFormModal
        visible={editOpen}
        title="Edit supplier"
        values={form}
        onChange={setForm}
        onSave={() => void saveEdit()}
        onCancel={() => setEditOpen(false)}
      />
    </ScreenContainer>
  );
}
