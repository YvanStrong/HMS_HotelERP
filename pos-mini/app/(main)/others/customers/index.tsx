import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ActionButton } from '../../../../src/components/ActionButton';
import { ConfirmModal } from '../../../../src/components/ConfirmModal';
import { EntityFormModal, type EntityFormValues } from '../../../../src/components/EntityFormModal';
import { ListCard } from '../../../../src/components/ListCard';
import { ListToolbar } from '../../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../../src/components/StatusBadge';
import { usePaginatedList } from '../../../../src/hooks/usePaginatedList';
import {
  createCustomer,
  deleteCustomer,
  listCustomersPaginated,
  updateCustomer,
} from '../../../../src/repositories/customerRepository';
import type { Customer } from '../../../../src/types';
import { useAppStore } from '../../../../src/store/appStore';
import { formatMoney } from '../../../../src/utils/currency';

const emptyForm: EntityFormValues = { name: '', phone: '', email: '', address: '', notes: '' };

export default function CustomersScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<EntityFormValues>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchPage = useCallback(
    (params: Parameters<typeof listCustomersPaginated>[0]) => listCustomersPaginated(params),
    [],
  );

  const {
    items: customers,
    total,
    loading,
    loadingMore,
    refreshing,
    search,
    setSearch,
    loadMore,
    refresh,
    hasMore,
    reload,
  } = usePaginatedList<Customer>(fetchPage);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
    });
    setModalVisible(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    try {
      if (editing) {
        await updateCustomer(editing.id, {
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
        });
        Toast.show({ type: 'success', text1: 'Customer updated' });
      } else {
        await createCustomer({
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
          creditLimit: 0,
        });
        Toast.show({ type: 'success', text1: 'Customer created' });
      }
      setModalVisible(false);
      await reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCustomer(deleteId);
      Toast.show({ type: 'success', text1: 'Customer deleted' });
      setDeleteId(null);
      await reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Delete failed' });
    }
  };

  return (
    <ScreenContainer>
      <ActionButton label="+ Add Customer" onPress={openAdd} className="mb-3" />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search name, phone, email…"
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={customers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard
            onPress={() =>
              router.push({
                pathname: '/(main)/others/customers/[customerId]',
                params: { customerId: item.id },
              })
            }
            onLongPress={() => setDeleteId(item.id)}
          >
            <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="font-bold text-app-text">{item.name}</Text>
                  {item.phone ? <Text className="text-sm text-app-muted">{item.phone}</Text> : null}
                  {item.email ? <Text className="text-sm text-app-muted">{item.email}</Text> : null}
                </View>
                {item.totalDebt > 0 ? (
                  <StatusBadge
                    label={formatMoney(item.totalDebt, settings)}
                    tone="warning"
                  />
                ) : null}
              </View>
          </ListCard>
        )}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No customers"
        emptyMessage="Add your first customer."
      />
      </ScreenList>

      <EntityFormModal
        visible={modalVisible}
        title={editing ? 'Edit Customer' : 'New Customer'}
        values={form}
        onChange={setForm}
        onSave={() => void save()}
        onCancel={() => setModalVisible(false)}
      />

      <ConfirmModal
        visible={Boolean(deleteId)}
        title="Delete customer?"
        message="This cannot be undone."
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </ScreenContainer>
  );
}
