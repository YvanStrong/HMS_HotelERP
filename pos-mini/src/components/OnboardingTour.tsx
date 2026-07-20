import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setOnboardingComplete } from '../repositories/metaRepository';
import { useThemeColors } from '../hooks/useTheme';

const STEPS = [
  {
    icon: 'grid' as const,
    title: 'Welcome to POS Mini',
    body: 'The home screen shows today’s sales and quick access to every module — sales, products, stock, and reports.',
  },
  {
    icon: 'cart' as const,
    title: 'Start a sale',
    body: 'Tap New Sale (or the Sales module) to scan products, apply discounts, and take payment. Pin favorite products for one-tap adds.',
  },
  {
    icon: 'settings' as const,
    title: 'Settings & backup',
    body: 'Configure your business, printers, and staff under Settings. Back up your data regularly from Settings → Backup.',
  },
  {
    icon: 'restaurant' as const,
    title: 'Tables & more',
    body: 'Restaurant and bar types get table service and kitchen tickets. Explore modules as your business grows.',
  },
];

type Props = {
  visible: boolean;
  onComplete: () => void;
};

export function OnboardingTour({ visible, onComplete }: Props) {
  const colors = useThemeColors();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  const finish = async () => {
    await setOnboardingComplete(true);
    setStep(0);
    onComplete();
  };

  const next = () => {
    if (isLast) void finish();
    else setStep((s) => s + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-end bg-black/50 p-4">
        <View className="rounded-2xl border border-app-border bg-app-surface p-5">
          <View className="mb-4 items-center">
            <View
              className="mb-3 h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.primarySoft }}
            >
              <Ionicons name={current.icon} size={28} color={colors.primary} />
            </View>
            <Text className="text-center text-xl font-bold text-app-text">{current.title}</Text>
            <Text className="mt-2 text-center text-app-muted">{current.body}</Text>
          </View>
          <View className="mb-4 flex-row justify-center gap-2">
            {STEPS.map((_, i) => (
              <View
                key={i}
                className="h-2 rounded-full"
                style={{
                  width: i === step ? 20 : 8,
                  backgroundColor: i === step ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => void finish()}
              className="flex-1 rounded-xl border border-app-border py-3"
            >
              <Text className="text-center font-semibold text-app-text">Skip</Text>
            </Pressable>
            <Pressable onPress={next} className="flex-1 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
              <Text className="text-center font-semibold text-white">{isLast ? 'Get started' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
