import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { KeyboardAvoidingScreen, KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { NumericKeypad } from '../../../src/components/NumericKeypad';
import { useAppStore } from '../../../src/store/appStore';
import { clearPin, hasPinSet, setPinHash, verifyPin } from '../../../src/utils/pin';
import {
  getRecoveryQuestion,
  hasPinRecovery,
  setPinRecovery,
  verifyRecoveryAnswer,
} from '../../../src/utils/pinRecovery';

export default function SecuritySettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const refreshSettings = useAppStore((s) => s.refreshSettings);
  const lock = useAppStore((s) => s.lock);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [recoverySet, setRecoverySet] = useState(false);
  const [mode, setMode] = useState<'idle' | 'new' | 'confirm' | 'verify' | 'recovery' | 'forgot'>('idle');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');

  useFocusEffect(
    useCallback(() => {
      void hasPinSet().then(setPinSet);
      void hasPinRecovery().then(setRecoverySet);
      void getRecoveryQuestion().then((q) => { if (q) setRecoveryQuestion(q); });
      setPinEnabled(settings?.pinEnabled ?? false);
    }, [settings]),
  );

  const togglePin = async (enabled: boolean) => {
    if (enabled && !pinSet) {
      setMode('new');
      setPinEnabled(true);
      return;
    }
    if (!enabled) {
      await updateSettings({ pinEnabled: false });
      setPinEnabled(false);
      Toast.show({ type: 'success', text1: 'PIN lock disabled' });
      return;
    }
    await updateSettings({ pinEnabled: true });
    setPinEnabled(true);
    Toast.show({ type: 'success', text1: 'PIN lock enabled' });
  };

  const startChangePin = () => {
    if (pinSet) {
      setMode('verify');
      setPin('');
    } else {
      setMode('new');
      setNewPin('');
    }
  };

  const verifyCurrentPin = async () => {
    const ok = await verifyPin(pin);
    if (!ok) {
      Toast.show({ type: 'error', text1: 'Incorrect PIN' });
      setPin('');
      return;
    }
    setMode('new');
    setNewPin('');
    setPin('');
  };

  const saveNewPin = async () => {
    if (newPin.length < 4) {
      Toast.show({ type: 'error', text1: 'PIN must be at least 4 digits' });
      return;
    }
    if (mode === 'new') {
      setPin(newPin);
      setNewPin('');
      setMode('confirm');
      return;
    }
    if (mode === 'confirm' && newPin !== pin) {
      Toast.show({ type: 'error', text1: 'PINs do not match' });
      setNewPin('');
      return;
    }

    await setPinHash(newPin);
    await updateSettings({ pinEnabled: true });
    setPinSet(true);
    setPinEnabled(true);
    setMode('recovery');
    setNewPin('');
    setPin('');
    Toast.show({ type: 'success', text1: 'PIN set — add recovery question' });
  };

  const saveRecovery = async () => {
    if (!recoveryQuestion.trim() || !recoveryAnswer.trim()) {
      Toast.show({ type: 'error', text1: 'Question and answer required' });
      return;
    }
    await setPinRecovery(recoveryQuestion, recoveryAnswer);
    setRecoverySet(true);
    setMode('idle');
    setRecoveryAnswer('');
    Toast.show({ type: 'success', text1: 'Recovery question saved' });
  };

  const verifyForgotAnswer = async () => {
    const ok = await verifyRecoveryAnswer(forgotAnswer);
    if (!ok) {
      Toast.show({ type: 'error', text1: 'Incorrect answer' });
      setForgotAnswer('');
      return;
    }
    setMode('new');
    setNewPin('');
    setForgotAnswer('');
    Toast.show({ type: 'info', text1: 'Set a new PIN' });
  };

  const removePin = async () => {
    await clearPin();
    await updateSettings({ pinEnabled: false });
    await refreshSettings();
    setPinSet(false);
    setPinEnabled(false);
    Toast.show({ type: 'success', text1: 'PIN removed' });
  };

  if (mode === 'forgot') {
    return (
      <KeyboardAvoidingScreen>
        <View className="flex-1 px-4 pt-4">
          <Text className="mb-2 text-xl font-bold text-black">Forgot PIN</Text>
          <Text className="mb-4 text-sm text-gray-600">{recoveryQuestion}</Text>
          <TextInput
            value={forgotAnswer}
            onChangeText={setForgotAnswer}
            placeholder="Your answer"
            className="mb-4 rounded-xl border border-app-border bg-white px-3 py-3"
          />
          <Pressable onPress={() => void verifyForgotAnswer()} className="mb-2 rounded-xl bg-app-primary py-4">
            <Text className="text-center font-bold text-white">Verify</Text>
          </Pressable>
          <Pressable onPress={() => setMode('idle')} className="rounded-xl border py-3">
            <Text className="text-center font-bold text-black">Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingScreen>
    );
  }

  if (mode === 'recovery') {
    return (
      <KeyboardAvoidingScreen>
        <View className="flex-1 px-4 pt-4">
          <Text className="mb-4 text-xl font-bold text-black">Recovery question</Text>
          <TextInput
            value={recoveryQuestion}
            onChangeText={setRecoveryQuestion}
            placeholder="e.g. Mother's maiden name?"
            className="mb-3 rounded-xl border border-app-border bg-white px-3 py-3"
          />
          <TextInput
            value={recoveryAnswer}
            onChangeText={setRecoveryAnswer}
            placeholder="Answer (case insensitive)"
            className="mb-4 rounded-xl border border-app-border bg-white px-3 py-3"
          />
          <Pressable onPress={() => void saveRecovery()} className="mb-2 rounded-xl bg-app-primary py-4">
            <Text className="text-center font-bold text-white">Save</Text>
          </Pressable>
          <Pressable onPress={() => setMode('idle')} className="rounded-xl border py-3">
            <Text className="text-center font-bold text-black">Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingScreen>
    );
  }

  if (mode === 'verify') {
    return (
      <KeyboardAvoidingScreen>
        <View className="flex-1 px-4 pt-4">
          <Text className="mb-4 text-xl font-bold text-black">Enter current PIN</Text>
          <NumericKeypad value={pin} onChange={setPin} maxLength={8} />
          <Pressable onPress={() => void verifyCurrentPin()} className="mt-4 rounded-xl bg-app-primary py-4">
            <Text className="text-center font-bold text-white">Continue</Text>
          </Pressable>
          <Pressable onPress={() => setMode('idle')} className="mt-2 rounded-xl border py-3">
            <Text className="text-center font-bold text-black">Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingScreen>
    );
  }

  if (mode === 'new' || mode === 'confirm') {
    return (
      <KeyboardAvoidingScreen>
        <View className="flex-1 px-4 pt-4">
          <Text className="mb-4 text-xl font-bold text-black">
            {mode === 'confirm' ? 'Confirm PIN' : 'Set new PIN'}
          </Text>
          <NumericKeypad value={newPin} onChange={setNewPin} maxLength={8} />
          <Pressable onPress={() => void saveNewPin()} className="mt-4 rounded-xl bg-app-primary py-4">
            <Text className="text-center font-bold text-white">Save PIN</Text>
          </Pressable>
          <Pressable onPress={() => { setMode('idle'); setPin(''); setNewPin(''); }} className="mt-2 rounded-xl border py-3">
            <Text className="text-center font-bold text-black">Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingScreen>
    );
  }

  return (
    <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <Text className="font-bold text-black">PIN lock</Text>
        <Switch value={pinEnabled} onValueChange={(v) => void togglePin(v)} />
      </View>

      <Text className="mb-4 text-sm text-gray-600">
        {pinSet ? 'PIN is set.' : 'No PIN set.'}
        {recoverySet ? ' Recovery question configured.' : ''}
      </Text>

      <Pressable onPress={startChangePin} className="mb-3 rounded-xl bg-app-primary py-3">
        <Text className="text-center font-bold text-white">{pinSet ? 'Change PIN' : 'Set PIN'}</Text>
      </Pressable>

      {pinSet && recoverySet ? (
        <Pressable onPress={() => setMode('forgot')} className="mb-3 rounded-xl border border-app-border py-3">
          <Text className="text-center font-bold text-black">Forgot PIN?</Text>
        </Pressable>
      ) : null}

      {pinSet ? (
        <Pressable onPress={() => void removePin()} className="mb-3 rounded-xl border py-3">
          <Text className="text-center font-bold text-black">Remove PIN</Text>
        </Pressable>
      ) : null}

      {pinEnabled ? (
        <Pressable onPress={lock} className="rounded-xl border py-3">
          <Text className="text-center font-bold text-black">Lock Now</Text>
        </Pressable>
      ) : null}
    </KeyboardFormScroll>
  );
}
