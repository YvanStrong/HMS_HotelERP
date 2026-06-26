import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { useAppStore } from '../../../src/store/appStore';
import { colors } from '../../../src/constants/theme';

export default function TaxSettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('0');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [taxName, setTaxName] = useState('Tax');
  const [lowStockAlert, setLowStockAlert] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!settings) return;
      setTaxEnabled(settings.taxEnabled);
      setTaxRate(String(settings.taxRate));
      setTaxInclusive(settings.taxInclusive);
      setTaxName(settings.taxName ?? 'Tax');
      setLowStockAlert(settings.lowStockAlert ?? true);
    }, [settings]),
  );

  const save = async () => {
    try {
      await updateSettings({
        taxEnabled,
        taxRate: Number(taxRate) || 0,
        taxInclusive,
        taxName: taxName.trim() || 'Tax',
        lowStockAlert,
      });
      Toast.show({ type: 'success', text1: 'Tax settings saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  return (
    <KeyboardFormScroll>
      <View className="mb-3 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <Text className="font-semibold text-app-text">Enable tax</Text>
        <Switch value={taxEnabled} onValueChange={setTaxEnabled} />
      </View>
      {taxEnabled ? (
        <>
          <FormField label="Tax name" value={taxName} onChangeText={setTaxName} placeholder="VAT, GST…" />
          <FormField label="Tax rate (%)" value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" placeholder="18" />
          <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="font-semibold text-app-text">Tax inclusive pricing</Text>
              <Text className="text-xs text-app-muted">Prices already include tax</Text>
            </View>
            <Switch value={taxInclusive} onValueChange={setTaxInclusive} />
          </View>
        </>
      ) : null}
      <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <View className="flex-1 pr-3">
          <Text className="font-semibold text-app-text">Low stock alert</Text>
          <Text className="text-xs text-app-muted">Notify when products fall below minimum stock</Text>
        </View>
        <Switch value={lowStockAlert} onValueChange={setLowStockAlert} />
      </View>
      <Pressable onPress={() => void save()} className="rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Save tax settings</Text>
      </Pressable>
    </KeyboardFormScroll>
  );
}
