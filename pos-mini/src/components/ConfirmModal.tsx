import { Modal, Pressable, Text, View } from 'react-native';
import { cardStyle, colors, primaryButtonStyle } from '../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full p-5" style={cardStyle}>
          <Text className="text-lg font-bold text-app-text">{title}</Text>
          <Text className="mt-2 text-app-muted">{message}</Text>
          <View className="mt-5 flex-row justify-end gap-3">
            <Pressable onPress={onCancel} className="rounded-lg border border-app-border px-4 py-2">
              <Text className="font-semibold text-app-text">{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              className="rounded-lg px-4 py-2"
              style={{
                ...primaryButtonStyle,
                backgroundColor: destructive ? colors.danger : colors.primary,
              }}
            >
              <Text className="font-semibold text-white">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
