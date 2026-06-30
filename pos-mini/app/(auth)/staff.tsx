import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { NumericKeypad } from '../../src/components/NumericKeypad';
import { listStaff, verifyStaffPin } from '../../src/repositories/staffRepository';
import { setCurrentStaffId } from '../../src/repositories/metaRepository';
import type { Staff } from '../../src/types';
import { useAppStore } from '../../src/store/appStore';
import { colors, primaryButtonStyle } from '../../src/constants/theme';

export default function StaffSignInScreen() {
  const router = useRouter();
  const refreshStaff = useAppStore((s) => s.refreshStaff);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');

  useFocusEffect(
    useCallback(() => {
      void listStaff().then((list) => {
        setStaff(list);
        if (list.length === 0) router.replace('/');
      });
    }, [router]),
  );

  const confirm = async () => {
    if (!selected) {
      Toast.show({ type: 'error', text1: 'Select a staff member' });
      return;
    }
    const ok = await verifyStaffPin(selected.id, pin);
    if (!ok) {
      Toast.show({ type: 'error', text1: 'Incorrect PIN' });
      setPin('');
      return;
    }
    await setCurrentStaffId(selected.id);
    await refreshStaff();
    router.replace('/');
  };

  if (selected) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg px-4 pt-10">
        <Text className="mb-2 text-center text-2xl font-bold text-app-text">Staff sign-in</Text>
        <Text className="mb-6 text-center text-app-muted">{selected.name}</Text>
        <NumericKeypad value={pin} onChange={setPin} maxLength={8} />
        <Pressable onPress={() => void confirm()} className="mt-4 rounded-xl py-4" style={primaryButtonStyle}>
          <Text className="text-center text-lg font-semibold text-white">Sign in</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setSelected(null);
            setPin('');
          }}
          className="mt-2 rounded-xl border border-app-border py-3"
        >
          <Text className="text-center font-bold text-app-text">Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg px-4 pt-10">
      <Text className="mb-2 text-center text-2xl font-bold text-app-text">Who is working?</Text>
      <Text className="mb-6 text-center text-app-muted">Select your name to continue</Text>
      {staff.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => setSelected(s)}
          className="mb-2 rounded-xl border border-app-border bg-app-surface p-4"
        >
          <Text className="text-lg font-semibold text-app-text">{s.name}</Text>
          <Text className="text-sm capitalize text-app-muted">{s.role}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => router.replace('/')}
        className="mt-4 rounded-xl border border-app-border py-3"
        style={{ backgroundColor: colors.surface }}
      >
        <Text className="text-center font-bold text-app-text">Skip</Text>
      </Pressable>
    </SafeAreaView>
  );
}
