import { Image, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  uri: string | null | undefined;
  size?: number;
  style?: StyleProp<ImageStyle>;
  rounded?: boolean;
};

export function ProductPhoto({ uri, size = 64, style, rounded = true }: Props) {
  const colors = useThemeColors();
  const radius = rounded ? 10 : 0;

  if (!uri) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Ionicons name="image-outline" size={size * 0.4} color={colors.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size, borderRadius: radius, backgroundColor: colors.border }, style]}
      resizeMode="cover"
    />
  );
}
