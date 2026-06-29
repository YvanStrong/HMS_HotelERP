import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../store/appStore';
import { colors } from '../constants/theme';

type Props = {
  variant?: 'icon' | 'full';
};

export function LogoutButton({ variant = 'icon' }: Props) {
  const router = useRouter();
  const lock = useAppStore((s) => s.lock);
  const pinRequired = useAppStore((s) => s.pinRequired);

  const onLogout = () => {
    lock();
    if (pinRequired) {
      router.replace('/(auth)/pin');
      return;
    }
    Toast.show({
      type: 'info',
      text1: 'Session ended',
      text2: 'Enable PIN in Settings for secure lock on logout',
    });
    router.replace('/');
  };

  if (variant === 'full') {
    return (
      <Pressable
        onPress={onLogout}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface py-3 active:opacity-90"
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text className="font-semibold text-app-danger">Log out</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onLogout}
      accessibilityLabel="Log out"
      className="rounded-lg border border-app-border bg-app-surface p-2 active:opacity-90"
    >
      <Ionicons name="log-out-outline" size={22} color={colors.danger} />
    </Pressable>
  );
}
