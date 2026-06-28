import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ActionButton } from '../../../../src/components/ActionButton';
import { ConfirmModal } from '../../../../src/components/ConfirmModal';
import { EntityFormModal, type EntityFormValues } from '../../../../src/components/EntityFormModal';
import { ListCard } from '../../../../src/components/ListCard';
import { ListToolbar } from '../../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../../src/components/ScreenContainer';
import { usePaginatedList } from '../../../../src/hooks/usePaginatedList';
import {
  createSupplier,
  deleteSupplier,
  listSuppliersPaginated,
  updateSupplier,
} from '../../../../src/repositories/supplierRepository';
import type { Supplier } from '../../../../src/types';

const emptyForm: EntityFormValues = { name: '', phone: '', email: '', address: '', notes: '' };

export default function SuppliersScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<EntityFormValues>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchPage = useCallback(
    (params: Parameters<typeof listSuppliersPaginated>[0]) => listSuppliersPaginated(params),
    [],
  );

  const {
    items: suppliers,
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
  } = usePaginatedList<Supplier>(fetchPage);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
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
        await updateSupplier(editing.id, {
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
        });
        Toast.show({ type: 'success', text1: 'Supplier updated' });
      } else {
        await createSupplier({
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
        });
        Toast.show({ type: 'success', text1: 'Supplier created' });
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
      await deleteSupplier(deleteId);
      Toast.show({ type: 'success', text1: 'Supplier deleted' });
      setDeleteId(null);
      await reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Delete failed' });
    }
  };

  return (
    <ScreenContainer>
      <ActionButton label="+ Add Supplier" onPress={openAdd} className="mb-3" />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search suppliers…"
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={suppliers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard
            onPress={() =>
              router.push({
                pathname: '/(main)/others/suppliers/[supplierId]',
                params: { supplierId: item.id },
              })
            }
            onLongPress={() => openEdit(item)}
          >
            <Text className="font-bold text-app-text">{item.name}</Text>
            {item.phone ? <Text className="text-sm text-app-muted">{item.phone}</Text> : null}
            {item.email ? <Text className="text-sm text-app-muted">{item.email}</Text> : null}
          </ListCard>
        )}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No suppliers"
        emptyMessage="Add your first supplier."
      />
      </ScreenList>

      <EntityFormModal
        visible={modalVisible}
        title={editing ? 'Edit Supplier' : 'New Supplier'}
        values={form}
        onChange={setForm}
        onSave={() => void save()}
        onCancel={() => setModalVisible(false)}
      />

      <ConfirmModal
        visible={Boolean(deleteId)}
        title="Delete supplier?"
        message="This cannot be undone."
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </ScreenContainer>
  );
}
