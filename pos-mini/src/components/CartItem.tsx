import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { CartItem } from '../types';
import { formatMoney } from '../utils/currency';
import { formatQuantity, parseQuantityInput } from '../utils/quantity';
import { useAppStore } from '../store/appStore';
import { cardStyle, colors } from '../constants/theme';
import { ProductPhoto } from './ProductPhoto';
import { QuantityEditModal } from './QuantityEditModal';

type Props = {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  onSetQuantity: (quantity: number) => void;
};

export function CartItemRow({ item, onIncrease, onDecrease, onRemove, onSetQuantity }: Props) {
  const settings = useAppStore((s) => s.settings);
  const lineTotal = item.unitPrice * item.quantity - item.discountAmount;
  const [showQtyEdit, setShowQtyEdit] = useState(false);
  const [qtyInput, setQtyInput] = useState('');

  const openQtyEdit = () => {
    setQtyInput(formatQuantity(item.quantity));
    setShowQtyEdit(true);
  };

  const applyQty = () => {
    const qty = parseQuantityInput(qtyInput);
    if (!qty) {
      Toast.show({ type: 'error', text1: 'Enter a valid quantity' });
      return;
    }
    onSetQuantity(qty);
    setShowQtyEdit(false);
  };

  const qtyHint = item.trackStock ? `In stock: ${formatQuantity(item.stockQty)}` : undefined;

  return (
    <>
      <View className="mb-2 flex-row items-center" style={cardStyle}>
        <ProductPhoto uri={item.imageUri} size={48} />
        <View className="min-w-0 flex-1 px-3 py-3">
          <Text className="font-semibold text-app-text" numberOfLines={2}>
            {item.productName}
          </Text>
          {item.modifiers?.length ? (
            <Text className="text-xs text-app-muted" numberOfLines={2}>
              {item.modifiers.map((m) => m.optionName).join(', ')}
            </Text>
          ) : null}
          <Text className="text-sm text-app-muted">
            {formatMoney(item.unitPrice, settings)} × {formatQuantity(item.quantity)}
          </Text>
          <Text className="font-bold text-app-text">{formatMoney(lineTotal, settings)}</Text>
        </View>
        <View className="flex-row items-center gap-1.5 pr-2">
          <Pressable
            onPress={onDecrease}
            className="h-8 w-8 items-center justify-center rounded-lg border border-app-border"
          >
            <Text className="font-bold text-app-text">−</Text>
          </Pressable>
          <Pressable
            onPress={openQtyEdit}
            className="h-8 min-w-[28px] items-center justify-center rounded-lg border border-app-border px-1"
          >
            <Text className="text-center text-sm font-bold text-app-text">
              {formatQuantity(item.quantity)}
            </Text>
          </Pressable>
          <Pressable
            onPress={onIncrease}
            className="h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="font-bold text-white">+</Text>
          </Pressable>
          <Pressable onPress={onRemove} className="ml-0.5 h-8 w-8 items-center justify-center">
            <Text className="text-lg font-bold text-app-danger">×</Text>
          </Pressable>
        </View>
      </View>
      <QuantityEditModal
        visible={showQtyEdit}
        title={item.productName}
        hint={qtyHint}
        value={qtyInput}
        onChange={setQtyInput}
        onApply={applyQty}
        onCancel={() => setShowQtyEdit(false)}
      />
    </>
  );
}
