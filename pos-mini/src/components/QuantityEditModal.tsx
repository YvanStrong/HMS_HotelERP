import { Modal, Pressable, Text, View } from 'react-native';
import { NumericKeypad } from './NumericKeypad';

type Props = {
  visible: boolean;
  title: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
};

export function QuantityEditModal({ visible, title, hint, value, onChange, onApply, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl bg-app-surface p-4">
          <Text className="mb-1 text-lg font-bold text-app-text">{title}</Text>
          {hint ? <Text className="mb-3 text-sm text-app-muted">{hint}</Text> : null}
          <NumericKeypad value={value} onChange={onChange} onSubmit={onApply} />
          <Pressable onPress={onCancel} className="mt-2 rounded-xl border border-app-border py-3">
            <Text className="text-center font-semibold text-app-text">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
