import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onLock?: () => void;
  pinRequired?: boolean;
};

export function HomeMenuModal({ visible, onClose, onLock, pinRequired }: Props) {
  const router = useRouter();

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <View className="absolute right-4 top-16 min-w-[220px] rounded-xl border border-app-border bg-app-surface p-2 shadow-lg">
          {pinRequired && onLock ? (
            <Pressable
              onPress={() => {
                onClose();
                onLock();
              }}
              className="flex-row items-center gap-3 rounded-lg px-4 py-3 active:bg-app-bg"
            >
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
              <Text className="font-medium text-app-text">Lock app</Text>
            </Pressable>
          ) : null}
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
