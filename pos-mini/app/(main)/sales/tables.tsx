import { useCallback, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { useThemedStyles } from '../../../src/hooks/useTheme';
import { useBusinessFeatures } from '../../../src/hooks/useBusinessFeatures';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import {
  createTable,
  listTables,
  mergeTables,
} from '../../../src/repositories/tableRepository';
import type { PosTable } from '../../../src/types';

export default function TablesScreen() {
  const router = useRouter();
  const { cardStyle, colors } = useThemedStyles();
  const { hasTableService } = useBusinessFeatures();
  const settings = useAppStore((s) => s.settings);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [mergeSource, setMergeSource] = useState<PosTable | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSeats, setNewSeats] = useState('4');

  const load = useCallback(async () => {
    setTables(await listTables());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!hasTableService) {
    return (
      <ScreenContainer>
        <Text className="text-app-muted">Table service is enabled for restaurant and bar business types.</Text>
      </ScreenContainer>
    );
  }

  const openTable = (table: PosTable) => {
    router.push({ pathname: '/(main)/sales/new', params: { tableId: table.id } });
  };

  const handleTablePress = async (table: PosTable) => {
    if (mergeSource) {
      if (mergeSource.id === table.id) {
        setMergeSource(null);
        return;
      }
      try {
        await mergeTables(mergeSource.id, table.id);
        Toast.show({ type: 'success', text1: `Merged ${mergeSource.name} into ${table.name}` });
        setMergeSource(null);
        await load();
      } catch (e) {
        Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Merge failed' });
      }
      return;
    }
    openTable(table);
  };

  const addTable = async () => {
    if (!newName.trim()) {
      Toast.show({ type: 'error', text1: 'Table name required' });
      return;
    }
    try {
      await createTable(newName.trim(), Number(newSeats) || 4);
      setShowAdd(false);
      setNewName('');
      await load();
      Toast.show({ type: 'success', text1: 'Table added' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  const statusColor = (table: PosTable) => {
    if (table.status === 'occupied') return colors.warning;
    if (mergeSource?.id === table.id) return colors.primary;
    return colors.primarySoft;
  };

  return (
    <ScreenContainer scroll>
      <Text className="mb-3 text-sm text-app-muted">
        Tap a table to open or resume its bill. Long-press a table, then tap another to merge bills.
      </Text>

      {mergeSource ? (
        <View className="mb-3 rounded-xl border border-app-primary bg-app-primary-soft p-3">
          <Text className="font-semibold text-app-text">
            Merging {mergeSource.name} — tap destination table
          </Text>
          <Pressable onPress={() => setMergeSource(null)} className="mt-2">
            <Text className="text-sm font-semibold text-app-primary">Cancel merge</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="mb-4 flex-row flex-wrap gap-3">
        {tables.map((table) => (
          <Pressable
            key={table.id}
            onPress={() => void handleTablePress(table)}
            onLongPress={() => {
              if (table.status === 'occupied') setMergeSource(table);
            }}
            style={[cardStyle, { width: '47%', backgroundColor: statusColor(table) }]}
            className="rounded-xl p-4"
          >
            <Text className="text-lg font-bold text-app-text">{table.name}</Text>
            <Text className="text-sm text-app-muted">{table.seats} seats</Text>
            <Text className="mt-1 text-xs font-semibold uppercase text-app-text">{table.status}</Text>
            {table.openBillTotal != null && table.openBillTotal > 0 ? (
              <Text className="mt-1 font-semibold text-app-text">
                {formatMoney(table.openBillTotal, settings)}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => setShowAdd(true)}
        className="mb-8 rounded-xl py-3"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-center font-semibold text-white">Add table</Text>
      </Pressable>

      <Modal visible={showAdd} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-2xl bg-app-surface p-4">
            <Text className="mb-3 text-xl font-bold text-app-text">New table</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Table name"
              className="mb-3 rounded-lg border border-app-border px-3 py-3 text-app-text"
            />
            <TextInput
              value={newSeats}
              onChangeText={setNewSeats}
              placeholder="Seats"
              keyboardType="number-pad"
              className="mb-4 rounded-lg border border-app-border px-3 py-3 text-app-text"
            />
            <Pressable onPress={() => void addTable()} className="mb-2 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
              <Text className="text-center font-semibold text-white">Save</Text>
            </Pressable>
            <Pressable onPress={() => setShowAdd(false)} className="rounded-xl border border-app-border py-3">
              <Text className="text-center font-semibold text-app-text">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
