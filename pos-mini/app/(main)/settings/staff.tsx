import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ConfirmModal } from '../../../src/components/ConfirmModal';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import {
  createStaff,
  deactivateStaff,
  listStaff,
  slugifyUsername,
} from '../../../src/repositories/staffRepository';
import type { StaffRole } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { useThemeColors } from '../../../src/hooks/useTheme';

export default function StaffSettingsScreen() {
  const colors = useThemeColors();
  const currentStaff = useAppStore((s) => s.currentStaff);
  const refreshStaff = useAppStore((s) => s.refreshStaff);
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof listStaff>>>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<StaffRole>('cashier');
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
      await createStaff({
        name: name.trim(),
        username: username.trim() || undefined,
        role,
        pin,
      });
      setName('');
      setUsername('');
      setPin('');
      await load();
      Toast.show({ type: 'success', text1: 'Staff added' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await deactivateStaff(deleteId);
      if (currentStaff?.id === deleteId) {
        await refreshStaff();
      }
      setDeleteId(null);
      await load();
      Toast.show({ type: 'success', text1: 'Staff removed' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Could not remove staff' });
    }
  };

  return (
    <ScreenContainer scroll>
      <Text className="mb-2 text-sm text-app-muted">
        Staff sign in with username + PIN. Device PIN is skipped when staff accounts exist.
      </Text>
      {currentStaff ? (
        <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-3">
          <Text className="text-sm text-app-muted">Signed in now</Text>
          <Text className="font-semibold text-app-text">
            {currentStaff.name} (@{currentStaff.username})
          </Text>
        </View>
      ) : null}
      {staff.map((s) => (
        <View key={s.id} className="mb-2 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface p-3">
          <View className="min-w-0 flex-1 pr-2">
            <Text className="font-semibold text-app-text">{s.name}</Text>
            <Text className="text-sm text-app-muted">@{s.username}</Text>
            <Text className="text-xs capitalize text-app-muted">{s.role}</Text>
          </View>
          <Pressable
            onPress={() => setDeleteId(s.id)}
            className="rounded-lg border border-app-danger px-3 py-1.5"
          >
            <Text className="text-sm font-semibold text-app-danger">Remove</Text>
          </Pressable>
        </View>
      ))}
      <Text className="mb-2 mt-4 font-bold text-app-text">Add staff</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (!username.trim()) setUsername(slugifyUsername(v));
        }}
        placeholder="Full name"
        className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
      />
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username (login)"
        autoCapitalize="none"
        autoCorrect={false}
        className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
      />
      <TextInput
        value={pin}
        onChangeText={setPin}
        placeholder="PIN (4+ digits)"
        keyboardType="number-pad"
        secureTextEntry
        className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
      />
      <View className="mb-3 flex-row gap-2">
        {(['cashier', 'manager'] as StaffRole[]).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            className="flex-1 rounded-lg border border-app-border py-2"
            style={{ backgroundColor: role === r ? colors.primarySoft : colors.surface }}
          >
            <Text className="text-center capitalize text-app-text">{r}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => void add()} className="rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Add staff member</Text>
      </Pressable>

      <ConfirmModal
        visible={Boolean(deleteId)}
        title="Remove staff member?"
        message="They will no longer be able to sign in. Past sales they made are kept."
        confirmLabel="Remove"
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setDeleteId(null)}
      />
    </ScreenContainer>
  );
}
