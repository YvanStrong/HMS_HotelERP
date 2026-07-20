import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { ProductVariant } from '../types';
import { formatMoney } from '../utils/currency';
import { useAppStore } from '../store/appStore';

type Props = {
  visible: boolean;
  productName: string;
  variants: ProductVariant[];
  onSelect: (variant: ProductVariant) => void;
  onCancel: () => void;
};

export function VariantPickerModal({ visible, productName, variants, onSelect, onCancel }: Props) {
  const settings = useAppStore((s) => s.settings);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[70%] rounded-t-2xl border-t border-app-border bg-app-surface p-4">
          <Text className="mb-1 text-xl font-bold text-app-text">Choose variant</Text>
          <Text className="mb-4 text-app-muted">{productName}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {variants.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => onSelect(v)}
                className="mb-2 rounded-xl border border-app-border bg-app-bg p-3"
              >
                <Text className="font-semibold text-app-text">{v.name}</Text>
                <Text className="text-sm text-app-muted">
                  {formatMoney(v.sellPrice, settings)} · Stock: {v.stockQty}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onCancel} className="mt-2 rounded-xl border border-app-border py-3">
            <Text className="text-center font-bold text-app-text">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
