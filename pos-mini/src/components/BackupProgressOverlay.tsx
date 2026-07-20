import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Modal, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  label?: string;
  detail?: string;
};

export function BackupProgressOverlay({ visible, label = 'Creating backup…', detail }: Props) {
  const colors = useThemeColors();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!visible) return;
    const spinLoop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, useNativeDriver: true }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ]),
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      spin.setValue(0);
      pulse.setValue(0.6);
    };
  }, [visible, spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/45 px-8">
        <Animated.View
          className="w-full items-center rounded-2xl px-6 py-8"
          style={{ backgroundColor: colors.surface, opacity: pulse }}
        >
          <Animated.View style={{ transform: [{ rotate }] }} className="mb-4">
            <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
          </Animated.View>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-center text-lg font-bold text-app-text">{label}</Text>
          {detail ? <Text className="mt-2 text-center text-sm text-app-muted">{detail}</Text> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}
