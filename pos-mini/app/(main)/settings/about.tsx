import { Text, View } from 'react-native';
import Constants from 'expo-constants';
import { ScreenContainer } from '../../../src/components/ScreenContainer';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScreenContainer>
      <View className="items-center rounded-xl border border-app-border bg-app-surface p-6">
        <Text className="text-2xl font-bold text-app-text">POS Mini</Text>
        <Text className="mt-1 text-app-muted">Offline point of sale</Text>
        <Text className="mt-4 text-sm text-app-muted">Version {version}</Text>
      </View>
      <View className="mt-4 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="mb-2 font-semibold text-app-text">Features</Text>
        <Text className="text-sm leading-6 text-app-muted">
          • 100% offline — data stays on your device{'\n'}
          • Sales, purchases, refunds, stock, shifts{'\n'}
          • Split payments, held carts, staff roles{'\n'}
          • Reports, CSV import/export, backups{'\n'}
          • Barcode scan, scale barcodes, receipt printing
        </Text>
      </View>
      <View className="mt-4 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="mb-2 font-semibold text-app-text">Bluetooth printing (dev build)</Text>
        <Text className="text-sm leading-6 text-app-muted">
          Real Bluetooth thermal printing requires a custom dev client built with EAS (`eas build --profile development`).
          Install the optional native module react-native-thermal-receipt-printer-image-qr in your dev build.
          Expo Go simulates prints to the console.
        </Text>
      </View>
    </ScreenContainer>
  );
}
