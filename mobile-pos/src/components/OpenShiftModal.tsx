import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Depot } from "../types";

type Props = {
  visible: boolean;
  depot: Depot;
  waiterName: string;
  busy: boolean;
  requireShift?: boolean;
  onStart: (openingFloat: number) => void;
  onSkip: () => void;
  onClose: () => void;
};

export function OpenShiftModal({
  visible,
  depot,
  waiterName,
  busy,
  requireShift = true,
  onStart,
  onSkip,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [floatText, setFloatText] = useState("0");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <Text allowFontScaling={false} className="text-xl font-bold text-slate-900">{t("startYourShift")}</Text>
          <Text allowFontScaling={false} className="mt-2 text-sm text-slate-700">
            {t("waiter")}: {waiterName}
          </Text>
          <Text allowFontScaling={false} className="text-sm text-slate-700">
            {t("outlet")}: {depot.name}
          </Text>
          <Text className="text-sm text-slate-500">
            {new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </Text>

          <Text allowFontScaling={false} className="mt-4 text-sm text-slate-700">{t("shiftCoversAll")}</Text>
          <Text allowFontScaling={false} className="mb-2 mt-5 text-sm font-medium text-slate-800">
            {t("openingFloat")}
          </Text>
          <TextInput
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900"
            keyboardType="decimal-pad"
            value={floatText}
            onChangeText={setFloatText}
            placeholder="0"
          />

          <Pressable
            disabled={busy}
            onPress={() => onStart(Number.parseFloat(floatText) || 0)}
            className="mt-5 min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 py-4"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text allowFontScaling={false} className="font-semibold text-white">{t("startShift")}</Text>
            )}
          </Pressable>

          {requireShift === false ? (
            <Pressable disabled={busy} onPress={onSkip} className="mt-3 min-h-[44px] items-center justify-center py-2">
              <Text allowFontScaling={false} className="text-sm text-slate-600">{t("skipNoShift")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
