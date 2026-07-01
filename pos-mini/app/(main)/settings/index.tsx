import { Switch, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HubLink } from '../../../src/components/HubLink';
import { LogoutButton } from '../../../src/components/LogoutButton';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { useAppStore } from '../../../src/store/appStore';
import { changeAppLanguage } from '../../../src/i18n';
import { useThemeColors } from '../../../src/hooks/useTheme';
import { useBusinessFeatures } from '../../../src/hooks/useBusinessFeatures';

export default function SettingsIndex() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const { hasModifiers } = useBusinessFeatures();

  return (
    <ScreenContainer scroll>
      <View className="mb-3 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <Text className="font-semibold text-app-text">{t('settings.darkMode')}</Text>
        <Switch
          value={themeMode === 'dark'}
          onValueChange={(v) => void setThemeMode(v ? 'dark' : 'light')}
          trackColor={{ true: colors.primary }}
        />
      </View>
      <View className="mb-3 rounded-xl border border-app-border bg-app-surface px-4 py-3">
        <Text className="mb-2 font-semibold text-app-text">{t('settings.language')}</Text>
        <View className="flex-row gap-2">
          {(['en', 'fr'] as const).map((lang) => (
            <Pressable
              key={lang}
              onPress={() => void changeAppLanguage(lang)}
              className="flex-1 rounded-lg border py-2"
              style={{
                borderColor: i18n.language === lang ? colors.primary : colors.border,
                backgroundColor: i18n.language === lang ? colors.primarySoft : colors.surface,
              }}
            >
              <Text className="text-center font-semibold text-app-text">
                {lang === 'en' ? t('settings.english') : t('settings.french')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <HubLink label="Business information" href="/(main)/settings/business" subtitle="Name, logo, address, contact" />
      <HubLink label="Currency" href="/(main)/settings/currency" subtitle="Currency code and symbol" />
      <HubLink label="Alerts" href="/(main)/settings/alerts" subtitle="Low stock and backup reminders" />
      <HubLink label="Payment methods" href="/(main)/settings/payment" subtitle="Cash, card, mobile, credit" />
      <HubLink label="Receipt customization" href="/(main)/settings/receipt" subtitle="Logo, tax, change, barcodes" />
      <HubLink label="Discount rules" href="/(main)/settings/discounts" subtitle="Automatic discount rules" />
      {hasModifiers ? (
        <HubLink label={t('settings.modifiers')} href={'/(main)/settings/modifiers' as never} subtitle="Size, toppings, extras" />
      ) : null}
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
