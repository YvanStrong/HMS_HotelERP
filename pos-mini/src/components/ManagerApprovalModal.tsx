import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { NumericKeypad } from './NumericKeypad';
import { verifyManagerPin } from '../repositories/staffRepository';
import { usePrimaryButtonStyle } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onApproved: () => void;
  onCancel: () => void;
};

export function ManagerApprovalModal({ visible, title, message, onApproved, onCancel }: Props) {
  const primaryButtonStyle = usePrimaryButtonStyle();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!pin.trim()) {
      Toast.show({ type: 'error', text1: 'Enter manager PIN' });
      return;
    }
    setBusy(true);
    try {
      const manager = await verifyManagerPin(pin);
      if (!manager) {
        Toast.show({ type: 'error', text1: 'Invalid manager PIN' });
        return;
      }
      setPin('');
      onApproved();
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setPin('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl border-t border-app-border bg-app-surface p-4">
          <Text className="mb-1 text-xl font-bold text-app-text">{title}</Text>
          <Text className="mb-4 text-app-muted">{message}</Text>
          <NumericKeypad value={pin} onChange={setPin} maxLength={8} secure allowReveal />
          <Pressable
            disabled={busy}
            onPress={() => void confirm()}
            className="mt-4 rounded-xl py-4"
            style={primaryButtonStyle}
          >
            <Text className="text-center text-lg font-semibold text-white">Approve</Text>
          </Pressable>
          <Pressable onPress={cancel} className="mt-2 rounded-xl border border-app-border py-3">
            <Text className="text-center font-bold text-app-text">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
