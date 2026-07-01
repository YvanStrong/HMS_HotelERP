import { Pressable, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { ProductCard } from './ProductCard';
import type { Product } from '../types';
import { useAppStore } from '../store/appStore';
import { formatMoney } from '../utils/currency';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  product: Product;
  onPress: () => void;
  onEditPrice: () => void;
  onDeactivate: () => void;
};

export function SwipeableProductRow({ product, onPress, onEditPrice, onDeactivate }: Props) {
  const colors = useThemeColors();
  const settings = useAppStore((s) => s.settings);
  const margin =
    product.sellPrice > 0
      ? ((product.sellPrice - product.costPrice) / product.sellPrice) * 100
      : 0;

  const renderRightActions = () => (
    <View className="mb-2 ml-2 flex-row">
      <Pressable
        onPress={onEditPrice}
        className="items-center justify-center rounded-l-xl px-4"
        style={{ backgroundColor: colors.primary }}
      >
        <Ionicons name="pricetag-outline" size={20} color="#fff" />
        <Text className="mt-1 text-xs font-semibold text-white">Price</Text>
      </Pressable>
      <Pressable
        onPress={onDeactivate}
        className="items-center justify-center rounded-r-xl px-4"
        style={{ backgroundColor: colors.danger }}
      >
        <Ionicons name="eye-off-outline" size={20} color="#fff" />
        <Text className="mt-1 text-xs font-semibold text-white">Hide</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View>
        <ProductCard product={product} onPress={onPress} />
        <Text className="-mt-1 mb-2 px-1 text-xs text-app-muted">
          Margin {margin.toFixed(1)}% · {formatMoney(product.sellPrice - product.costPrice, settings)} / unit
        </Text>
      </View>
    </Swipeable>
  );
}
