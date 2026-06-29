import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { EmptyState } from './EmptyState';
import { EntityFormModal, type EntityFormValues } from './EntityFormModal';
import { SearchBar } from './SearchBar';
import {
  createCustomer,
  listCustomers,
  searchCustomers,
} from '../repositories/customerRepository';
import type { Customer } from '../types';
import { cardStyle, colors } from '../constants/theme';

const emptyForm: EntityFormValues = { name: '', phone: '', email: '', address: '', notes: '' };

type Props = {
  visible: boolean;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
};

export function CustomerPickerModal({ visible, selectedId, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<EntityFormValues>(emptyForm);

  const loadCustomers = useCallback(async (q: string) => {
    const list = q.trim() ? await searchCustomers(q.trim()) : await listCustomers();
    setCustomers(list);
  }, []);

  useEffect(() => {
    if (visible) void loadCustomers(query);
  }, [visible, query, loadCustomers]);

  const onQueryChange = (text: string) => {
    setQuery(text);
    void loadCustomers(text);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setShowAddForm(true);
  };

  const saveNewCustomer = async () => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Customer name is required' });
      return;
    }
    try {
      const created = await createCustomer({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      });
      setShowAddForm(false);
      setForm(emptyForm);
      await loadCustomers(query);
      onSelect(created);
      onClose();
      Toast.show({ type: 'success', text1: 'Customer added' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Could not add customer' });
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView
          className="flex-1 bg-app-bg"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between border-b border-app-border bg-app-surface px-4 py-3">
            <Text className="text-lg font-bold text-app-text">Select customer</Text>
            <Pressable onPress={onClose} className="rounded-lg border border-app-border px-3 py-1">
              <Text className="font-semibold text-app-text">Close</Text>
            </Pressable>
          </View>

          <View className="px-4 pt-3">
            <SearchBar
              value={query}
              onChangeText={onQueryChange}
              placeholder="Search by name or phone…"
            />
            <Pressable
              onPress={openAdd}
              className="mb-3 rounded-xl py-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center font-semibold text-white">+ Add new customer</Text>
            </Pressable>
          </View>

          {customers.length === 0 ? (
            <EmptyState
              title="No customers found"
              message={query ? 'Try a different search or add a new customer.' : 'Add your first customer.'}
            />
          ) : (
            <FlashList
              data={customers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[
                    cardStyle,
                    {
                      marginBottom: 8,
                      borderColor: selectedId === item.id ? colors.primary : colors.border,
                      backgroundColor: selectedId === item.id ? colors.primarySoft : colors.surface,
                    },
                  ]}
                  className="p-3 active:opacity-90"
                >
                  <Text className="font-semibold text-app-text">{item.name}</Text>
                  {item.phone ? <Text className="text-sm text-app-muted">{item.phone}</Text> : null}
                  {item.email ? <Text className="text-sm text-app-muted">{item.email}</Text> : null}
                </Pressable>
              )}
            />
          )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <EntityFormModal
        visible={showAddForm}
        title="New customer"
        values={form}
        onChange={setForm}
        onSave={() => void saveNewCustomer()}
        onCancel={() => setShowAddForm(false)}
        saveLabel="Add customer"
      />
    </>
  );
}
