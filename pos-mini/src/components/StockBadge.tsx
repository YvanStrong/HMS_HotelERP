import { Text, View } from 'react-native';

type Props = {
  qty: number;
  minStock: number;
  unit?: string;
};

export function StockBadge({ qty, minStock, unit = 'pcs' }: Props) {
  const isLow = qty <= minStock;
  return (
    <View
      className="self-start border border-black px-2 py-0.5"
      style={{ backgroundColor: isLow ? '#fef08a' : '#dcfce7' }}
    >
      <Text className="text-xs font-bold text-black">
        {qty} {unit}
        {isLow ? ' · Low' : ''}
      </Text>
    </View>
  );
}
