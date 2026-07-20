import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ConfirmModal } from '../../../src/components/ConfirmModal';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import {
  createDiscountRule,
  deleteDiscountRule,
  listDiscountRules,
} from '../../../src/repositories/discountRepository';
import type { DiscountRule, DiscountType } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

export default function DiscountsSettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<DiscountType>('percent');
  const [value, setValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('0');

  const load = useCallback(async () => {
    setRules(await listDiscountRules(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const resetForm = () => {
    setName('');
    setType('percent');
    setValue('');
    setMinPurchase('0');
    setShowForm(false);
  };

  const saveRule = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    const numValue = Number(value);
    if (!numValue || numValue <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid discount value' });
      return;
    }
    try {
      await createDiscountRule({
        name: name.trim(),
        type,
        value: numValue,
        minPurchase: Number(minPurchase) || 0,
        isActive: true,
      });
      Toast.show({ type: 'success', text1: 'Discount rule created' });
      resetForm();
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDiscountRule(deleteId);
      Toast.show({ type: 'success', text1: 'Rule deleted' });
      setDeleteId(null);
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Delete failed' });
    }
  };

  if (showForm) {
    return (
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text className="mb-4 text-xl font-bold text-app-text">New Discount Rule</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Rule name"
          className="mb-3 border-2 border-app-border bg-app-surface px-3 py-3 text-app-text"
        />
        <View className="mb-3 flex-row gap-2">
          {(['percent', 'fixed'] as DiscountType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              className={`border-2 border-app-border px-4 py-2 ${type === t ? 'bg-app-primary-soft border-app-primary' : 'bg-app-surface border-app-border'}`}
            >
              <Text className="font-bold capitalize text-app-text">{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={type === 'percent' ? 'Percent (e.g. 10)' : 'Fixed amount'}
          keyboardType="decimal-pad"
          className="mb-3 border-2 border-app-border bg-app-surface px-3 py-3 text-app-text"
        />
        <TextInput
          value={minPurchase}
          onChangeText={setMinPurchase}
          placeholder="Minimum purchase"
          keyboardType="decimal-pad"
          className="mb-3 border-2 border-app-border bg-app-surface px-3 py-3 text-app-text"
        />
        <Pressable onPress={() => void saveRule()} className="border-2 border-app-border bg-app-primary py-4">
          <Text className="text-center font-bold text-white">Save Rule</Text>
        </Pressable>
        <Pressable onPress={resetForm} className="mt-2 border-2 border-app-border py-3">
          <Text className="text-center font-bold text-app-text">Cancel</Text>
        </Pressable>
      </KeyboardFormScroll>
    );
  }

  return (
    <>
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-app-text">Discount Rules</Text>
          <Pressable onPress={() => setShowForm(true)} className="border-2 border-app-border bg-app-primary px-4 py-2">
            <Text className="font-bold text-white">Add</Text>
          </Pressable>
        </View>

        {rules.length === 0 ? (
          <Text className="text-gray-600">No discount rules yet.</Text>
        ) : (
          rules.map((rule) => (
            <View key={rule.id} className="mb-2 border-2 border-app-border bg-app-surface p-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="font-bold text-app-text">{rule.name}</Text>
                  <Text className="text-sm text-gray-600">
                    {rule.type === 'percent' ? `${rule.value}% off` : `${formatMoney(rule.value, settings)} off`}
                    {rule.minPurchase > 0
                      ? ` · min ${formatMoney(rule.minPurchase, settings)}`
                      : ''}
                  </Text>
                  {!rule.isActive ? (
                    <Text className="text-xs text-red-600">Inactive</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => setDeleteId(rule.id)} className="border border-app-border px-2 py-1">
                  <Text className="text-sm font-bold text-red-600">Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </KeyboardFormScroll>

      <ConfirmModal
        visible={deleteId !== null}
        title="Delete rule?"
        message="This discount rule will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
