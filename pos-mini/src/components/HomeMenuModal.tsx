import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getLastSaleId } from '../repositories/metaRepository';
import { getSaleWithItems } from '../repositories/saleRepository';
import { printReceipt, savedPrinterAddress } from '../printing/PrinterService';
import { useAppStore } from '../store/appStore';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onLock?: () => void;
  pinRequired?: boolean;
};

export function HomeMenuModal({ visible, onClose, onLock, pinRequired }: Props) {
  const colors = useThemeColors();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  const reprintLast = async () => {
    onClose();
    const saleId = await getLastSaleId();
    if (!saleId || !settings) {
      Toast.show({ type: 'error', text1: 'No recent sale to reprint' });
      return;
    }
    const sale = await getSaleWithItems(saleId);
    if (!sale?.items?.length) {
      Toast.show({ type: 'error', text1: 'Last sale not found' });
      return;
    }
    try {
      const addr = await savedPrinterAddress();
      if (!addr) {
        router.push(`/(main)/sales/${saleId}` as never);
        Toast.show({ type: 'info', text1: 'Open receipt to share or configure printer' });
        return;
      }
      const result = await printReceipt(sale, sale.items, settings);
      Toast.show({
        type: 'success',
        text1: result.simulated ? 'Reprint simulated' : 'Last receipt reprinted',
        text2: sale.invoiceNumber,
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Reprint failed' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <View className="absolute right-4 top-16 min-w-[220px] rounded-xl border border-app-border bg-app-surface p-2 shadow-lg">
            {pinRequired || onLock ? (
            <Pressable
              onPress={() => {
                onClose();
                onLock?.();
              }}
              className="flex-row items-center gap-3 rounded-lg px-4 py-3 active:bg-app-bg"
            >
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
              <Text className="font-medium text-app-text">Lock / switch staff</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void reprintLast()}
            className="flex-row items-center gap-3 rounded-lg px-4 py-3 active:bg-app-bg"
          >
            <Ionicons name="print-outline" size={20} color={colors.primary} />
            <Text className="font-medium text-app-text">Reprint last receipt</Text>
          </Pressable>
          <Pressable
            onPress={() => go('/(main)/settings/backup')}
            className="flex-row items-center gap-3 rounded-lg px-4 py-3 active:bg-app-bg"
          >
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <Text className="font-medium text-app-text">Backup data</Text>
          </Pressable>
          <Pressable
            onPress={() => go('/(main)/settings/about')}
            className="flex-row items-center gap-3 rounded-lg px-4 py-3 active:bg-app-bg"
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text className="font-medium text-app-text">About POS Mini</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
