import { Switch, Text, View } from 'react-native';
import { HubLink } from '../../../src/components/HubLink';
import { LogoutButton } from '../../../src/components/LogoutButton';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { useAppStore } from '../../../src/store/appStore';
import { colors } from '../../../src/constants/theme';

export default function SettingsIndex() {
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  return (
    <ScreenContainer scroll>
      <View className="mb-3 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <Text className="font-semibold text-app-text">Dark mode</Text>
        <Switch
          value={themeMode === 'dark'}
          onValueChange={(v) => void setThemeMode(v ? 'dark' : 'light')}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <HubLink label="Business information" href="/(main)/settings/business" subtitle="Name, logo, address, contact" />
      <HubLink label="Currency" href="/(main)/settings/currency" subtitle="Currency code and symbol" />
      <HubLink label="Tax" href="/(main)/settings/tax" subtitle="Tax name, rate and inclusive pricing" />
      <HubLink label="Alerts" href="/(main)/settings/alerts" subtitle="Low stock and backup reminders" />
      <HubLink label="Payment methods" href="/(main)/settings/payment" subtitle="Cash, card, mobile, credit" />
      <HubLink label="Receipt customization" href="/(main)/settings/receipt" subtitle="Logo, tax, change, barcodes" />
      <HubLink label="Discount rules" href="/(main)/settings/discounts" subtitle="Automatic discount rules" />
      <HubLink label="Printer" href="/(main)/settings/printer" subtitle="Bluetooth printer and auto-print" />
      <HubLink label="Staff" href="/(main)/settings/staff" subtitle="Cashiers and managers" />
      <HubLink label="Shift / Z-report" href="/(main)/settings/shift" subtitle="Open and close shifts" />
      <HubLink label="PIN & security" href="/(main)/settings/security" subtitle="PIN lock and recovery" />
      <HubLink label="Backup & restore" href="/(main)/settings/backup" subtitle="Export, import, CSV" />
      <HubLink label="About POS Mini" href="/(main)/settings/about" subtitle="Version and dev build notes" />
      <LogoutButton variant="full" />
    </ScreenContainer>
  );
}
