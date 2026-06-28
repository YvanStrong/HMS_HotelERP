import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { createStaff, listStaff, updateStaff } from '../../../src/repositories/staffRepository';
import { setCurrentStaffId } from '../../../src/repositories/metaRepository';
import type { StaffRole } from '../../../src/types';
import { colors } from '../../../src/constants/theme';

export default function StaffSettingsScreen() {
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof listStaff>>>([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<StaffRole>('cashier');

  const load = useCallback(async () => {
    setStaff(await listStaff());
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const add = async () => {
    if (!name.trim() || pin.length < 4) {
      Toast.show({ type: 'error', text1: 'Name and 4+ digit PIN required' });
      return;
    }
    try {
      await createStaff({ name: name.trim(), role, pin });
      setName('');
      setPin('');
      await load();
      Toast.show({ type: 'success', text1: 'Staff added' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  const signIn = async (id: string) => {
    await setCurrentStaffId(id);
    Toast.show({ type: 'success', text1: 'Active staff set' });
  };

  return (
    <ScreenContainer>
      <Text className="mb-2 text-sm text-app-muted">Cashiers can sell; managers can void sales.</Text>
      {staff.map((s) => (
        <View key={s.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface p-3">
          <View>
            <Text className="font-semibold text-app-text">{s.name}</Text>
            <Text className="text-sm capitalize text-app-muted">{s.role}</Text>
          </View>
          <Pressable onPress={() => void signIn(s.id)} className="rounded-lg px-3 py-1" style={{ backgroundColor: colors.primarySoft }}>
            <Text className="text-sm font-semibold text-app-primary">Use</Text>
          </Pressable>
        </View>
      ))}
      <Text className="mb-2 mt-4 font-bold text-app-text">Add staff</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Name" className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text" />
      <TextInput value={pin} onChangeText={setPin} placeholder="PIN" keyboardType="number-pad" secureTextEntry className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text" />
      <View className="mb-3 flex-row gap-2">
        {(['cashier', 'manager'] as StaffRole[]).map((r) => (
          <Pressable key={r} onPress={() => setRole(r)} className="flex-1 rounded-lg border border-app-border py-2" style={{ backgroundColor: role === r ? colors.primarySoft : colors.surface }}>
            <Text className="text-center capitalize text-app-text">{r}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => void add()} className="rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Add staff member</Text>
      </Pressable>
    </ScreenContainer>
  );
}
