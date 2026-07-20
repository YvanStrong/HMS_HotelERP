import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import {
  getPosSettings,
  getRequireShift,
  getRequireStaffLogin,
  savePosSettings,
  saveRequireShift,
  saveRequireStaffLogin,
} from '../../../src/repositories/metaRepository';
import { useThemeColors } from '../../../src/hooks/useTheme';

export default function PosSettingsScreen() {
  const colors = useThemeColors();
  const [requireShift, setRequireShift] = useState(false);
  const [requireStaffLogin, setRequireStaffLogin] = useState(false);
  const [discountThreshold, setDiscountThreshold] = useState('10');

  const load = useCallback(async () => {
    const [shift, staffLogin, pos] = await Promise.all([
      getRequireShift(),
      getRequireStaffLogin(),
      getPosSettings(),
    ]);
    setRequireShift(shift);
    setRequireStaffLogin(staffLogin);
    setDiscountThreshold(String(pos.managerDiscountThresholdPercent));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const saveThreshold = async () => {
    const n = Number(discountThreshold);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      Toast.show({ type: 'error', text1: 'Enter a threshold between 0 and 100' });
      return;
    }
    await savePosSettings({ managerDiscountThresholdPercent: n });
    Toast.show({ type: 'success', text1: 'Discount threshold saved' });
  };

  return (
    <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <Text className="mb-4 text-sm text-app-muted">
        Control shift requirements, staff sign-in, and cashier permission limits.
      </Text>

      <View className="mb-3 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <View className="mr-3 flex-1">
          <Text className="font-semibold text-app-text">Require open shift for sales</Text>
          <Text className="mt-1 text-xs text-app-muted">When on, checkout is blocked until a shift is opened.</Text>
        </View>
        <Switch
          value={requireShift}
          onValueChange={(v) => {
            setRequireShift(v);
            void saveRequireShift(v).then(() =>
              Toast.show({ type: 'success', text1: v ? 'Shift required' : 'Shift optional' }),
            );
          }}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <View className="mb-3 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <View className="mr-3 flex-1">
          <Text className="font-semibold text-app-text">Force staff sign-in</Text>
          <Text className="mt-1 text-xs text-app-muted">
            When off, skip staff login at startup even if staff accounts exist.
          </Text>
        </View>
        <Switch
          value={requireStaffLogin}
          onValueChange={(v) => {
            setRequireStaffLogin(v);
            void saveRequireStaffLogin(v).then(() =>
              Toast.show({ type: 'success', text1: v ? 'Staff sign-in required' : 'Staff sign-in optional' }),
            );
          }}
          trackColor={{ true: colors.primary }}
        />
      </View>

      <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="mb-1 font-semibold text-app-text">Manager approval threshold</Text>
        <Text className="mb-3 text-xs text-app-muted">
          Cashiers need manager PIN for manual discounts above this percent of subtotal. Voids and large refunds always
          require manager role or PIN.
        </Text>
        <TextInput
          value={discountThreshold}
          onChangeText={setDiscountThreshold}
          keyboardType="decimal-pad"
          placeholder="10"
          className="mb-3 rounded-lg border border-app-border bg-app-bg px-3 py-3 text-app-text"
        />
        <Pressable onPress={() => void saveThreshold()} className="rounded-lg py-3" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold text-white">Save threshold</Text>
        </Pressable>
      </View>
    </KeyboardFormScroll>
  );
}
