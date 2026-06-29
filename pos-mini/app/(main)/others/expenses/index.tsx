import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { ActionButton } from '../../../../src/components/ActionButton';
import { ConfirmModal } from '../../../../src/components/ConfirmModal';
import { FormField } from '../../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../../src/components/KeyboardFormScroll';
import { ListCard } from '../../../../src/components/ListCard';
import { ListToolbar } from '../../../../src/components/ListToolbar';
import { PaginatedFlashList } from '../../../../src/components/PaginatedFlashList';
import { ScreenContainer, ScreenList } from '../../../../src/components/ScreenContainer';
import { StatusBadge } from '../../../../src/components/StatusBadge';
import { usePaginatedList } from '../../../../src/hooks/usePaginatedList';
import {
  createExpense,
  deleteExpense,
  listExpensesPaginated,
  type ExpenseListFilters,
} from '../../../../src/repositories/expenseRepository';
import type { Expense, PaymentMethod } from '../../../../src/types';
import { useAppStore } from '../../../../src/store/appStore';
import { selectedChipStyle, unselectedChipStyle } from '../../../../src/constants/theme';
import { formatMoney } from '../../../../src/utils/currency';
import { nowIso } from '../../../../src/utils/ids';

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Transport', 'Marketing', 'Other'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'mobile'];
const CATEGORY_FILTERS = CATEGORIES.map((c) => ({ key: c, label: c }));

export default function ExpensesScreen() {
  const settings = useAppStore((s) => s.settings);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(nowIso().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const filters = useMemo<ExpenseListFilters>(
    () => ({ category: categoryFilter ?? undefined }),
    [categoryFilter],
  );

  const fetchPage = useCallback(
    (params: Parameters<typeof listExpensesPaginated>[0]) => listExpensesPaginated(params),
    [],
  );

  const {
    items: expenses,
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
  } = usePaginatedList<Expense, ExpenseListFilters>(fetchPage, { filters });

  const save = async () => {
    if (!description.trim()) {
      Toast.show({ type: 'error', text1: 'Description is required' });
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' });
      return;
    }
    try {
      await createExpense({
        category,
        description: description.trim(),
        amount: amt,
        paymentMethod,
        date,
        notes: notes || null,
      });
      Toast.show({ type: 'success', text1: 'Expense added' });
      setShowForm(false);
      setDescription('');
      setAmount('');
      setNotes('');
      await reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteExpense(deleteId);
      Toast.show({ type: 'success', text1: 'Expense deleted' });
      setDeleteId(null);
      await reload();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Delete failed' });
    }
  };

  if (showForm) {
    return (
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text className="mb-2 font-semibold text-app-text">Category</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              className="rounded-lg border px-3 py-2"
              style={category === c ? selectedChipStyle : unselectedChipStyle}
            >
              <Text className="font-semibold text-app-text">{c}</Text>
            </Pressable>
          ))}
        </View>
        <FormField label="Description" required value={description} onChangeText={setDescription} />
        <FormField
          label="Amount"
          required
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <FormField label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Text className="mb-2 font-semibold text-app-text">Payment</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setPaymentMethod(m)}
              className="rounded-lg border px-3 py-2"
              style={paymentMethod === m ? selectedChipStyle : unselectedChipStyle}
            >
              <Text className="font-semibold capitalize text-app-text">{m}</Text>
            </Pressable>
          ))}
        </View>
        <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
        <ActionButton label="Save Expense" onPress={() => void save()} className="mb-2" />
        <ActionButton label="Cancel" onPress={() => setShowForm(false)} variant="secondary" />
      </KeyboardFormScroll>
    );
  }

  return (
    <ScreenContainer>
      <ActionButton label="+ Add Expense" onPress={() => setShowForm(true)} className="mb-3" />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search description…"
        filters={CATEGORY_FILTERS}
        activeFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        resultCount={total}
      />

      <ScreenList>
      <PaginatedFlashList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListCard onLongPress={() => setDeleteId(item.id)}>
            <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="font-bold text-app-text">{item.description}</Text>
                  <Text className="mt-0.5 text-sm text-app-muted">
                    {item.date} · {item.paymentMethod}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="font-bold text-app-text">
                    {formatMoney(item.amount, settings)}
                  </Text>
                  <StatusBadge label={item.category} tone="default" />
                </View>
              </View>
          </ListCard>
        )}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        onRefresh={refresh}
        onLoadMore={loadMore}
        hasMore={hasMore}
        emptyTitle="No expenses"
        emptyMessage="Track your first business expense."
      />
      </ScreenList>

      <ConfirmModal
        visible={Boolean(deleteId)}
        title="Delete expense?"
        message="This cannot be undone."
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </ScreenContainer>
  );
}
