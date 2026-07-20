import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import {
  getReceiptDisplayPrefs,
  saveReceiptDisplayPrefs,
  type ReceiptDisplayPrefs,
} from '../../../src/repositories/metaRepository';
import { useAppStore } from '../../../src/store/appStore';
import { useThemeColors } from '../../../src/hooks/useTheme';

export default function ReceiptSettingsScreen() {
  const colors = useThemeColors();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [taxName, setTaxName] = useState('Tax');
  const [display, setDisplay] = useState<ReceiptDisplayPrefs>({
    showLogo: true,
    showTax: true,
    showChange: true,
    showBarcode: false,
  });

  useFocusEffect(
    useCallback(() => {
      if (settings) {
        setReceiptHeader(settings.receiptHeader);
        setReceiptFooter(settings.receiptFooter);
        setTaxName(settings.taxName ?? 'Tax');
      }
      void getReceiptDisplayPrefs().then(setDisplay);
    }, [settings]),
  );

  const save = async () => {
    try {
      await updateSettings({ receiptHeader, receiptFooter, taxName: taxName.trim() || 'Tax' });
      await saveReceiptDisplayPrefs(display);
      Toast.show({ type: 'success', text1: 'Receipt settings saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const toggle = (key: keyof ReceiptDisplayPrefs) => {
    setDisplay((d) => ({ ...d, [key]: !d[key] }));
  };

  return (
    <KeyboardFormScroll>
      <FormField
        label="Receipt header"
        hint="Shown at the top of printed receipts"
        value={receiptHeader}
        onChangeText={setReceiptHeader}
        placeholder="Your business tagline"
        multiline
      />
      <FormField
        label="Receipt footer"
        value={receiptFooter}
        onChangeText={setReceiptFooter}
        placeholder="Thank you for your purchase!"
        multiline
      />
      <FormField
        label="Tax label"
        hint="Shown on receipts when tax is collected (e.g. VAT, GST)"
        value={taxName}
        onChangeText={setTaxName}
        placeholder="Tax"
      />

      <Text className="mb-2 text-sm font-semibold text-app-text">Show on receipt</Text>
      {(
        [
          ['showLogo', 'Business logo'],
          ['showTax', 'Tax breakdown'],
          ['showChange', 'Change amount'],
          ['showBarcode', 'Product barcodes'],
        ] as const
      ).map(([key, label]) => (
        <View
          key={key}
          className="mb-2 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3"
        >
          <Text className="font-semibold text-app-text">{label}</Text>
          <Switch value={display[key]} onValueChange={() => toggle(key)} />
        </View>
      ))}

      <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="mb-2 text-xs font-semibold uppercase text-app-muted">Preview</Text>
        {display.showLogo ? (
          <Text className="text-center text-xs text-app-muted">[Logo]</Text>
        ) : null}
        <Text className="text-center text-sm text-app-text">{receiptHeader || settings?.businessName}</Text>
        <Text className="my-2 text-center text-xs text-app-muted">— line items —</Text>
        {display.showTax ? <Text className="text-center text-xs text-app-muted">Tax: …</Text> : null}
        {display.showChange ? <Text className="text-center text-xs text-app-muted">Change: …</Text> : null}
        <Text className="text-center text-sm text-app-text">{receiptFooter || 'Thank you!'}</Text>
      </View>
      <Pressable onPress={() => void save()} className="rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Save receipt settings</Text>
      </Pressable>
    </KeyboardFormScroll>
  );
}
