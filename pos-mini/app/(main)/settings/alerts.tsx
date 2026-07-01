import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { useAppStore } from '../../../src/store/appStore';
import { useThemeColors } from '../../../src/hooks/useTheme';

export default function AlertsSettingsScreen() {
  const colors = useThemeColors();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [lowStockAlert, setLowStockAlert] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLowStockAlert(settings?.lowStockAlert ?? true);
    }, [settings]),
  );

  const save = async () => {
    try {
      await updateSettings({ lowStockAlert });
      Toast.show({ type: 'success', text1: 'Alert settings saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  return (
    <KeyboardFormScroll>
      <Text className="mb-4 text-sm text-app-muted">
        Local notifications when you open the app. Requires notification permission.
      </Text>
      <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <View className="flex-1 pr-3">
          <Text className="font-semibold text-app-text">Low stock alert</Text>
          <Text className="text-xs text-app-muted">Notify when products are below minimum stock</Text>
        </View>
        <Switch value={lowStockAlert} onValueChange={setLowStockAlert} />
      </View>
      <Text className="mb-4 text-sm text-app-muted">
        Backup reminders use your real last backup date (7+ days old), or a one-time nudge if you have products but never backed up.
      </Text>
      <Pressable onPress={() => void save()} className="rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Save</Text>
      </Pressable>
    </KeyboardFormScroll>
  );
}
