import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FormField } from '../../src/components/FormField';
import { KeyboardFormScroll } from '../../src/components/KeyboardFormScroll';
import { useAppStore } from '../../src/store/appStore';
import { colors } from '../../src/constants/theme';
import { setPinHash } from '../../src/utils/pin';

import { COMMON_CURRENCIES, filterCurrencies } from '../../src/constants/currencies';
import { SearchBar } from '../../src/components/SearchBar';

export default function SetupScreen() {
  const router = useRouter();
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [step, setStep] = useState(1);

  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');

  const finish = async () => {
    if (!businessName.trim()) {
      Toast.show({ type: 'error', text1: 'Business name is required' });
      return;
    }
    if (pinEnabled && pin.length < 4) {
      Toast.show({ type: 'error', text1: 'PIN must be at least 4 digits' });
      return;
    }
    if (pinEnabled && pin !== pinConfirm) {
      Toast.show({ type: 'error', text1: 'PIN confirmation does not match' });
      return;
    }

    try {
      await updateSettings({
        businessName: businessName.trim(),
        address,
        phone,
        email,
        currency,
        currencySymbol,
        pinEnabled,
      });
      if (pinEnabled) {
        await setPinHash(pin);
      }
      Toast.show({ type: 'success', text1: 'Setup complete' });
      router.replace('/');
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: e instanceof Error ? e.message : 'Setup failed',
      });
    }
  };

  return (
    <KeyboardFormScroll edges={['top', 'bottom']} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24 }}>
        <Text className="mb-1 text-2xl font-bold text-app-text">Welcome to POS Mini</Text>
        <Text className="mb-6 text-app-muted">Step {step} of 3</Text>

        {step === 1 ? (
          <View>
            <Text className="mb-3 text-lg font-semibold text-app-text">Business details</Text>
            <FormField
              label="Business name"
              required
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Sunrise Café"
            />
            <FormField label="Address" value={address} onChangeText={setAddress} placeholder="Street, city" />
            <FormField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 000 0000"
              keyboardType="phone-pad"
            />
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="contact@business.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Text className="mb-3 text-lg font-semibold text-app-text">Currency</Text>
            <Text className="mb-2 text-sm font-semibold text-app-text">Currency</Text>
            <SearchBar value={currencyQuery} onChangeText={setCurrencyQuery} placeholder="Search currencies..." />
            <View className="mb-4 flex-row flex-wrap gap-2">
              {(currencyQuery ? filterCurrencies(currencyQuery) : COMMON_CURRENCIES).map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => {
                    setCurrency(c.code);
                    setCurrencySymbol(c.symbol);
                  }}
                  className="rounded-lg border px-4 py-2"
                  style={{
                    borderColor: currency === c.code ? colors.primary : colors.border,
                    backgroundColor: currency === c.code ? colors.primarySoft : colors.surface,
                  }}
                >
                  <Text className="font-semibold text-app-text">{c.code}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Text className="mb-3 text-lg font-semibold text-app-text">Security (optional)</Text>
            <View className="mb-3 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
              <Text className="font-semibold text-app-text">PIN lock</Text>
              <Switch value={pinEnabled} onValueChange={setPinEnabled} />
            </View>
            {pinEnabled ? (
              <>
                <FormField
                  label="PIN code"
                  hint="At least 4 digits — used to lock the app"
                  value={pin}
                  onChangeText={setPin}
                  placeholder="••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={8}
                />
                <FormField
                  label="Confirm PIN"
                  value={pinConfirm}
                  onChangeText={setPinConfirm}
                  placeholder="••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={8}
                />
              </>
            ) : null}
          </View>
        ) : null}

        <View className="mt-8 flex-row justify-between gap-3">
          {step > 1 ? (
            <Pressable
              onPress={() => setStep(step - 1)}
              className="flex-1 rounded-xl border border-app-border bg-app-surface py-3"
            >
              <Text className="text-center font-semibold text-app-text">Back</Text>
            </Pressable>
          ) : (
            <View className="flex-1" />
          )}
          {step < 3 ? (
            <Pressable
              onPress={() => setStep(step + 1)}
              className="flex-1 rounded-xl py-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center font-semibold text-white">Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void finish()}
              className="flex-1 rounded-xl py-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center font-semibold text-white">Start using POS</Text>
            </Pressable>
          )}
        </View>
    </KeyboardFormScroll>
  );
}
