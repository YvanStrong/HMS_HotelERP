import { useCallback, useEffect, useState } from 'react';

import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { FlashList } from '@shopify/flash-list';

import { SafeAreaView } from 'react-native-safe-area-context';

import Toast from 'react-native-toast-message';

import { EmptyState } from './EmptyState';

import { FormField } from './FormField';

import { SearchBar } from './SearchBar';

import {

  createCustomer,

  listCustomers,

  searchCustomers,

} from '../repositories/customerRepository';

import type { Customer } from '../types';

import { useThemedStyles } from '../hooks/useTheme';



const emptyForm = { name: '', phone: '', email: '', address: '', notes: '' };



type Props = {

  visible: boolean;

  selectedId: string | null;

  onClose: () => void;

  onSelect: (customer: Customer) => void;

};



export function CustomerPickerModal({ visible, selectedId, onClose, onSelect }: Props) {

  const { cardStyle, colors } = useThemedStyles();

  const [query, setQuery] = useState('');

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const [saving, setSaving] = useState(false);



  const loadCustomers = useCallback(async (q: string) => {

    const list = q.trim() ? await searchCustomers(q.trim()) : await listCustomers();

    setCustomers(list);

  }, []);



  useEffect(() => {

    if (!visible) {

      setShowAddForm(false);

      setForm(emptyForm);

      setQuery('');

      return;

    }

    void loadCustomers(query);

  }, [visible, query, loadCustomers]);



  const openAdd = () => {

    setForm(emptyForm);

    setShowAddForm(true);

  };



  const saveNewCustomer = async () => {

    if (!form.name.trim()) {

      Toast.show({ type: 'error', text1: 'Customer name is required' });

      return;

    }

    setSaving(true);

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

    } finally {

      setSaving(false);

    }

  };



  const setField = (key: keyof typeof emptyForm, value: string) => {

    setForm((prev) => ({ ...prev, [key]: value }));

  };



  return (

    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>

      <SafeAreaView className="flex-1 bg-app-bg" edges={['top', 'bottom']}>

        <KeyboardAvoidingView

          className="flex-1"

          behavior={Platform.OS === 'ios' ? 'padding' : undefined}

        >

          {showAddForm ? (

            <View className="flex-1">

              <View className="flex-row items-center justify-between border-b border-app-border bg-app-surface px-4 py-3">

                <Pressable onPress={() => setShowAddForm(false)} hitSlop={8} className="rounded-lg px-2 py-1">

                  <Text className="font-semibold text-app-primary">Back</Text>

                </Pressable>

                <Text className="text-lg font-bold text-app-text">New customer</Text>

                <View className="w-14" />

              </View>

              <ScrollView

                className="flex-1 px-4 pt-4"

                keyboardShouldPersistTaps="handled"

                contentContainerStyle={{ paddingBottom: 32 }}

              >

                <FormField

                  label="Name"

                  required

                  value={form.name}

                  onChangeText={(v) => setField('name', v)}

                  placeholder="Full name"

                />

                <FormField

                  label="Phone"

                  value={form.phone}

                  onChangeText={(v) => setField('phone', v)}

                  placeholder="Phone number"

                  keyboardType="phone-pad"

                />

                <FormField

                  label="Email"

                  value={form.email}

                  onChangeText={(v) => setField('email', v)}

                  placeholder="Email address"

                  keyboardType="email-address"

                  autoCapitalize="none"

                />

                <FormField

                  label="Address"

                  value={form.address}

                  onChangeText={(v) => setField('address', v)}

                  placeholder="Street, city"

                />

                <FormField

                  label="Notes"

                  value={form.notes}

                  onChangeText={(v) => setField('notes', v)}

                  placeholder="Optional notes"

                  multiline

                />

                <Pressable

                  onPress={() => void saveNewCustomer()}

                  disabled={saving}

                  className="mt-2 rounded-xl py-4"

                  style={{ backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }}

                >

                  <Text className="text-center font-semibold text-white">

                    {saving ? 'Saving…' : 'Add customer'}

                  </Text>

                </Pressable>

              </ScrollView>

            </View>

          ) : (

            <View className="flex-1">

              <View className="flex-row items-center justify-between border-b border-app-border bg-app-surface px-4 py-3">

                <Text className="text-lg font-bold text-app-text">Select customer</Text>

                <Pressable onPress={onClose} className="rounded-lg border border-app-border px-3 py-1.5">

                  <Text className="font-semibold text-app-text">Close</Text>

                </Pressable>

              </View>



              <View className="px-4 pt-3">

                <SearchBar

                  value={query}

                  onChangeText={setQuery}

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



              <View className="min-h-0 flex-1">

                {customers.length === 0 ? (

                  <EmptyState

                    title="No customers found"

                    message={query ? 'Try a different search or add a new customer.' : 'Add your first customer.'}

                  />

                ) : (

                  <FlashList

                    data={customers}

                    keyExtractor={(item) => item.id}

                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}

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

              </View>

            </View>

          )}

        </KeyboardAvoidingView>

      </SafeAreaView>

    </Modal>

  );

}


