import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { SearchBar } from '../../../src/components/SearchBar';
import { ALL_CURRENCIES, COMMON_CURRENCIES, filterCurrencies } from '../../../src/constants/currencies';
import { useAppStore } from '../../../src/store/appStore';
import { colors } from '../../../src/constants/theme';

export default function CurrencySettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!settings) return;
      setCurrency(settings.currency);
      setCurrencySymbol(settings.currencySymbol);
    }, [settings]),
  );

  const list = useMemo(() => filterCurrencies(query), [query]);

  const save = async () => {
    try {
      await updateSettings({ currency, currencySymbol });
      Toast.show({ type: 'success', text1: 'Currency updated' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  return (
    <KeyboardFormScroll>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search currencies..." />
      <View className="mb-4 flex-row flex-wrap gap-2">
        {list.map((c) => (
          <Pressable
            key={c.code}
            onPress={() => {
              setCurrency(c.code);
              setCurrencySymbol(c.symbol);
            }}
            className="rounded-lg border px-3 py-2"
            style={{
              borderColor: currency === c.code ? colors.primary : colors.border,
              backgroundColor: currency === c.code ? colors.primarySoft : colors.surface,
            }}
          >
            <Text className="font-semibold text-app-text">{c.code}</Text>
            <Text className="text-xs text-app-muted">{c.name}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Selected symbol" value={currencySymbol} onChangeText={setCurrencySymbol} />
      <Pressable
        onPress={() => void save()}
        className="rounded-xl py-4"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-center font-semibold text-white">Save currency</Text>
      </Pressable>
    </KeyboardFormScroll>
  );
}
