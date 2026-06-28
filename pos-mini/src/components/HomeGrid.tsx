import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { cardStyle, colors } from '../constants/theme';

type Module = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const MODULES: Module[] = [
  { key: 'sales', title: 'Sales', icon: 'cart', route: '/(main)/sales' },
  { key: 'products', title: 'Products', icon: 'cube', route: '/(main)/products' },
  { key: 'purchases', title: 'Purchases', icon: 'bag-add', route: '/(main)/purchases' },
  { key: 'refunds', title: 'Refunds', icon: 'return-down-back', route: '/(main)/refunds' },
  { key: 'stock', title: 'Stock', icon: 'layers', route: '/(main)/stock' },
  { key: 'reporting', title: 'Reports', icon: 'bar-chart', route: '/(main)/reporting' },
  { key: 'settings', title: 'Settings', icon: 'settings', route: '/(main)/settings' },
  { key: 'others', title: 'Others', icon: 'ellipsis-horizontal', route: '/(main)/others' },
];

export function HomeGrid() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const gap = 12;
  const horizontalPad = 16;
  const tileWidth = (width - horizontalPad * 2 - gap) / 2;

  return (
    <View className="flex-row flex-wrap" style={{ gap }}>
      {MODULES.map((mod) => (
        <Pressable
          key={mod.key}
          onPress={() => router.push(mod.route as never)}
          style={[cardStyle, { width: tileWidth }]}
          className="active:opacity-90"
        >
          <View className="items-center justify-center p-4">
            <View
              className="mb-2 h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.primarySoft }}
            >
              <Ionicons name={mod.icon} size={22} color={colors.primary} />
            </View>
            <Text className="text-center text-sm font-semibold text-app-text">{mod.title}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
