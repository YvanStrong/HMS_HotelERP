import { Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { CartItemRow } from './CartItem';
import type { CartItem } from '../types';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  onSetQuantity: (quantity: number) => void;
};

export function SwipeableCartItem({ item, onIncrease, onDecrease, onRemove, onSetQuantity }: Props) {
  const colors = useThemeColors();
  const renderRightActions = () => (
    <Pressable
      onPress={onRemove}
      className="mb-2 ml-2 items-center justify-center rounded-xl px-5"
      style={{ backgroundColor: colors.danger }}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text className="mt-1 text-xs font-semibold text-white">Remove</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View>
        <CartItemRow
          item={item}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          onRemove={onRemove}
          onSetQuantity={onSetQuantity}
        />
      </View>
    </Swipeable>
  );
}
