import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { FormField } from '../../src/components/FormField';
import { NumericKeypad } from '../../src/components/NumericKeypad';
import { listStaff, verifyStaffLogin } from '../../src/repositories/staffRepository';
import { setCurrentStaffId } from '../../src/repositories/metaRepository';
import type { Staff } from '../../src/types';
import { useAppStore } from '../../src/store/appStore';
import { useThemeColors, usePrimaryButtonStyle } from '../../src/hooks/useTheme';

export default function StaffSignInScreen() {
  const colors = useThemeColors();
  const primaryButtonStyle = usePrimaryButtonStyle();
  const router = useRouter();
  const refreshStaff = useAppStore((s) => s.refreshStaff);
  const completeStaffSignIn = useAppStore((s) => s.completeStaffSignIn);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');

  useFocusEffect(
    useCallback(() => {
      void listStaff().then((list) => {
        setStaff(list);
        if (list.length === 0) router.replace('/');
      });
    }, [router]),
  );

  const signIn = async () => {
    const login = (username ?? '').trim();
    if (!login) {
      Toast.show({ type: 'error', text1: 'Enter your username' });
      return;
    }
    if (pin.length < 4) {
      Toast.show({ type: 'error', text1: 'Enter your PIN (4+ digits)' });
      return;
    }
    const member = await verifyStaffLogin(login, pin);
    if (!member) {
      Toast.show({ type: 'error', text1: 'Invalid username or PIN' });
      setPin('');
      return;
    }
    await setCurrentStaffId(member.id);
    await refreshStaff();
    completeStaffSignIn();
    router.replace('/');
  };

  const pickStaff = (member: Staff) => {
    setUsername(member.username ?? '');
    setPin('');
  };

  return (
    <SafeAreaView className="flex-1 bg-app-bg px-4 pt-6" edges={['top', 'bottom']}>
      <Text className="mb-1 text-center text-2xl font-bold text-app-text">Staff sign in</Text>
      <Text className="mb-6 text-center text-app-muted">Enter username and PIN to start your shift</Text>

      <FormField
        label="Username"
        value={username ?? ''}
        onChangeText={setUsername}
        placeholder="e.g. john.doe"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text className="mb-2 text-sm font-semibold text-app-text">PIN</Text>
      <NumericKeypad value={pin} onChange={setPin} maxLength={8} />

      <Pressable onPress={() => void signIn()} className="mt-4 rounded-xl py-4" style={primaryButtonStyle}>
        <Text className="text-center text-lg font-semibold text-white">Sign in</Text>
      </Pressable>

      <Text className="mb-2 mt-6 text-sm font-semibold text-app-text">Or tap your name</Text>
      {staff.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => pickStaff(s)}
          className="mb-2 rounded-xl border p-4"
          style={{
            borderColor: username === s.username ? colors.primary : colors.border,
            backgroundColor: username === s.username ? colors.primarySoft : colors.surface,
          }}
        >
          <Text className="text-lg font-semibold text-app-text">{s.name}</Text>
          <Text className="text-sm text-app-muted">@{s.username}</Text>
          <Text className="text-xs capitalize text-app-muted">{s.role}</Text>
        </Pressable>
      ))}
    </SafeAreaView>
  );
}
