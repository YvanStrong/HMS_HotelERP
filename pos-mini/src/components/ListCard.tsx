import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { cardStyle } from '../constants/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  highlight?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ListCard({ children, onPress, onLongPress, highlight, style }: Props) {
  const surface = (
    <View
      style={[
        cardStyle,
        highlight ? { backgroundColor: '#fef9c3', borderColor: '#eab308' } : undefined,
        { marginBottom: 8, padding: 12 },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} className="active:opacity-90">
        {surface}
      </Pressable>
    );
  }

  return surface;
}
