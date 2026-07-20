import { Modal, Pressable, Text, View } from 'react-native';
import { NumericKeypad } from './NumericKeypad';
import { usePrimaryButtonStyle } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  staffName: string;
  pin: string;
  onPinChange: (pin: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function StaffPinModal({ visible, staffName, pin, onPinChange, onConfirm, onCancel }: Props) {
  const primaryButtonStyle = usePrimaryButtonStyle();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl border-t border-app-border bg-app-surface p-4">
          <Text className="mb-2 text-xl font-bold text-app-text">Sign in as {staffName}</Text>
          <Text className="mb-4 text-app-muted">Enter staff PIN</Text>
          <NumericKeypad value={pin} onChange={onPinChange} maxLength={8} secure allowReveal />
          <Pressable onPress={onConfirm} className="mt-4 rounded-xl py-4" style={primaryButtonStyle}>
            <Text className="text-center text-lg font-semibold text-white">Confirm</Text>
          </Pressable>
          <Pressable onPress={onCancel} className="mt-2 rounded-xl border border-app-border py-3">
            <Text className="text-center font-bold text-app-text">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
