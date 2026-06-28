import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import {
  getPaymentMethodSettings,
  savePaymentMethodSettings,
} from '../../../src/repositories/metaRepository';
import { colors } from '../../../src/constants/theme';

export default function PaymentSettingsScreen() {
  const [cardEnabled, setCardEnabled] = useState(true);
  const [mobileEnabled, setMobileEnabled] = useState(true);
  const [creditEnabled, setCreditEnabled] = useState(true);
  const [mobileLabel, setMobileLabel] = useState('Mobile Money');

  useFocusEffect(
    useCallback(() => {
      void getPaymentMethodSettings().then((s) => {
        setCardEnabled(s.cardEnabled);
        setMobileEnabled(s.mobileEnabled);
        setCreditEnabled(s.creditEnabled);
        setMobileLabel(s.mobileMoneyLabel);
      });
    }, []),
  );

  const save = async () => {
    try {
      await savePaymentMethodSettings({
        cardEnabled,
        mobileEnabled,
        creditEnabled,
        mobileMoneyLabel: mobileLabel.trim() || 'Mobile Money',
      });
      Toast.show({ type: 'success', text1: 'Payment methods saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const row = (label: string, value: boolean, onChange: (v: boolean) => void, locked?: boolean) => (
    <View className="mb-2 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
      <Text className="font-semibold text-app-text">{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={locked} />
    </View>
  );

  return (
    <KeyboardFormScroll>
      {row('Cash', true, () => {}, true)}
      {row('Card', cardEnabled, setCardEnabled)}
      {row('Mobile money', mobileEnabled, setMobileEnabled)}
      {row('Debt / credit', creditEnabled, setCreditEnabled)}
      {mobileEnabled ? (
        <FormField
          label="Mobile money label"
          hint='e.g. "M-Pesa", "MTN MoMo"'
          value={mobileLabel}
          onChangeText={setMobileLabel}
        />
      ) : null}
      <Pressable
        onPress={() => void save()}
        className="mt-2 rounded-xl py-4"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-center font-semibold text-white">Save payment methods</Text>
      </Pressable>
    </KeyboardFormScroll>
  );
}
