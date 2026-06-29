import { Pressable, Text, View } from 'react-native';
import type { Product } from '../types';
import { formatMoney } from '../utils/currency';
import { useAppStore } from '../store/appStore';
import { cardStyle, colors } from '../constants/theme';
import { CategoryBadge } from './CategoryBadge';
import { ProductPhoto } from './ProductPhoto';
import { StockBadge } from './StockBadge';

type Props = {
  product: Product;
  onPress?: () => void;
  onAdd?: () => void;
  compact?: boolean;
};

export function ProductCard({ product, onPress, onAdd, compact }: Props) {
  const settings = useAppStore((s) => s.settings);
  const photoSize = compact ? 52 : 72;

  return (
    <Pressable onPress={onPress} className="mb-3 w-full active:opacity-90" style={cardStyle}>
      <View className="flex-row p-3">
        <ProductPhoto uri={product.imageUri} size={photoSize} />
        <View className="min-w-0 flex-1 pl-3">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-base font-semibold text-app-text" numberOfLines={2}>
              {product.name}
            </Text>
            {onAdd ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-lg font-bold text-white">+</Text>
              </Pressable>
            ) : null}
          </View>
          {product.categoryName ? (
            <View className="mt-1">
              <CategoryBadge name={product.categoryName} color={colors.primary} />
            </View>
          ) : null}
          <Text className="mt-2 text-lg font-bold text-app-primary">
            {formatMoney(product.sellPrice, settings)}
          </Text>
          {product.trackStock ? (
            <View className="mt-1">
              <StockBadge qty={product.stockQty} minStock={product.minStock} unit={product.unit} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
