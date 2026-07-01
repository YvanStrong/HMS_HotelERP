import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { NumericKeypad } from '../../src/components/NumericKeypad';
import { useAppStore } from '../../src/store/appStore';
import { usePrimaryButtonStyle, useThemeColors } from '../../src/hooks/useTheme';
import { setPinHash, verifyPin } from '../../src/utils/pin';
import {
  getRecoveryQuestion,
  hasPinRecovery,
  verifyRecoveryAnswer,
} from '../../src/utils/pinRecovery';

type Mode = 'enter' | 'forgot' | 'reset' | 'confirm';

export default function PinScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const primaryButtonStyle = usePrimaryButtonStyle();
  const unlock = useAppStore((s) => s.unlock);
  const [mode, setMode] = useState<Mode>('enter');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');

  const routeAfterUnlock = () => {
    router.replace('/');
  };

  useEffect(() => {
    void hasPinRecovery().then(setRecoveryAvailable);
  }, []);

  const submit = async () => {
    const ok = await verifyPin(pin);
    if (!ok) {
      Toast.show({ type: 'error', text1: 'Incorrect PIN' });
      setPin('');
      return;
    }
    unlock();
    await routeAfterUnlock();
  };

  const startForgot = async () => {
    const question = await getRecoveryQuestion();
    if (!question) {
      Toast.show({ type: 'error', text1: 'No recovery question set' });
      return;
    }
    setRecoveryQuestion(question);
    setForgotAnswer('');
    setMode('forgot');
  };

  const verifyForgot = async () => {
    const ok = await verifyRecoveryAnswer(forgotAnswer);
    if (!ok) {
      Toast.show({ type: 'error', text1: 'Incorrect answer' });
      setForgotAnswer('');
      return;
    }
    setNewPin('');
    setConfirmPin('');
    setMode('reset');
    Toast.show({ type: 'info', text1: 'Set a new PIN' });
  };

  const saveNewPin = async () => {
    if (newPin.length < 4) {
      Toast.show({ type: 'error', text1: 'PIN must be at least 4 digits' });
      return;
    }
    if (mode === 'reset') {
      setConfirmPin('');
      setMode('confirm');
      return;
    }
    if (newPin !== confirmPin) {
      Toast.show({ type: 'error', text1: 'PINs do not match' });
      setConfirmPin('');
      return;
    }
    await setPinHash(newPin);
    unlock();
    Toast.show({ type: 'success', text1: 'PIN updated' });
    await routeAfterUnlock();
  };

  if (mode === 'forgot') {
    return (
      <SafeAreaView className="flex-1 bg-app-bg px-4 pt-10">
        <Text className="mb-2 text-center text-2xl font-bold text-app-text">Forgot PIN</Text>
        <Text className="mb-4 text-center text-app-muted">{recoveryQuestion}</Text>
        <TextInput
          value={forgotAnswer}
          onChangeText={setForgotAnswer}
          placeholder="Your answer"
          autoCapitalize="none"
          className="mb-4 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
        />
        <Pressable onPress={() => void verifyForgot()} className="mb-2 rounded-xl py-4" style={primaryButtonStyle}>
          <Text className="text-center text-lg font-semibold text-white">Verify</Text>
        </Pressable>
        <Pressable onPress={() => setMode('enter')} className="rounded-xl border border-app-border py-3">
          <Text className="text-center font-bold text-app-text">Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (mode === 'reset' || mode === 'confirm') {
    return (
      <SafeAreaView className="flex-1 bg-app-bg px-4 pt-10">
        <Text className="mb-6 text-center text-2xl font-bold text-app-text">
          {mode === 'confirm' ? 'Confirm new PIN' : 'Set new PIN'}
        </Text>
        <NumericKeypad
          value={mode === 'confirm' ? confirmPin : newPin}
          onChange={mode === 'confirm' ? setConfirmPin : setNewPin}
          maxLength={8}
        />
        <Pressable onPress={() => void saveNewPin()} className="mt-4 rounded-xl py-4" style={primaryButtonStyle}>
          <Text className="text-center text-lg font-semibold text-white">
            {mode === 'confirm' ? 'Save PIN' : 'Continue'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode('enter');
            setNewPin('');
            setConfirmPin('');
          }}
          className="mt-2 rounded-xl border border-app-border py-3"
        >
          <Text className="text-center font-bold text-app-text">Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg px-4 pt-10">
      <Text className="mb-2 text-center text-2xl font-bold text-app-text">Enter PIN</Text>
      <Text className="mb-6 text-center text-app-muted">Unlock POS Mini</Text>
      <View className="mb-4 flex-row justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className="h-4 w-4 rounded-full border-2"
            style={{
              borderColor: colors.primary,
              backgroundColor: pin.length > i ? colors.primary : colors.surface,
            }}
          />
        ))}
      </View>
      <NumericKeypad value={pin} onChange={setPin} maxLength={8} />
      <Pressable onPress={() => void submit()} className="mt-4 rounded-xl py-4" style={primaryButtonStyle}>
        <Text className="text-center text-lg font-semibold text-white">Unlock</Text>
      </Pressable>
      {recoveryAvailable ? (
        <Pressable onPress={() => void startForgot()} className="mt-4 py-2">
          <Text className="text-center text-app-primary">Forgot PIN?</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
