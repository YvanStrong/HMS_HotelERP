import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import {
  changePosPin,
  clearPosPin,
  fetchHasPin,
  setPosPin,
} from "../../src/api/pinAuth";
import { apiErrorMessage } from "../../src/api/client";
import { PinPad } from "../../src/components/PinPad";
import { useHeaderPadding } from "../../src/hooks/useScreenInsets";
import { useAuthStore } from "../../src/store/authStore";

type Step = "menu" | "current" | "new" | "confirm";

export default function PinSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const headerPad = useHeaderPadding();
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const email = useAuthStore((s) => s.user?.email) ?? "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const reload = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      setHasPin(await fetchHasPin(hotelId));
    } catch {
      setHasPin(false);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetFlow() {
    setStep("menu");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  }

  async function saveNewPin() {
    if (!hotelId || newPin.length < 4 || newPin !== confirmPin) {
      Toast.show({ type: "error", text1: t("pinMismatch") });
      return;
    }
    setBusy(true);
    try {
      if (hasPin) {
        await changePosPin(hotelId, newPin, currentPin);
      } else {
        await setPosPin(hotelId, newPin);
      }
      Toast.show({ type: "success", text1: t("pinSaved") });
      resetFlow();
      await reload();
    } catch (err) {
      Toast.show({ type: "error", text1: t("pinChangeFailed"), text2: apiErrorMessage(err) });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setStep(hasPin ? "current" : "new");
    } finally {
      setBusy(false);
    }
  }

  async function removePin() {
    if (!hotelId) return;
    setBusy(true);
    try {
      await clearPosPin(hotelId);
      Toast.show({ type: "success", text1: t("pinCleared") });
      resetFlow();
      await reload();
    } catch (err) {
      Toast.show({ type: "error", text1: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: headerPad }}>
      <View className="flex-row items-center border-b border-slate-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color="#334155" />
        </Pressable>
        <Text className="text-lg font-bold text-slate-900">{t("pinSettings")}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-4">
          <View className="mb-4 rounded-xl bg-white p-4">
            <Text className="text-sm text-slate-600">{email}</Text>
            <Text className="mt-1 text-base font-semibold text-slate-900">
              {hasPin ? t("pinStatusSet") : t("pinStatusNotSet")}
            </Text>
            <Text className="mt-2 text-xs text-slate-500">{t("pinSettingsHint")}</Text>
          </View>

          {step === "menu" ? (
            <View className="gap-3">
              <Pressable
                disabled={busy}
                onPress={() => setStep(hasPin ? "current" : "new")}
                className="rounded-xl bg-indigo-600 py-4"
              >
                <Text className="text-center font-semibold text-white">
                  {hasPin ? t("changePin") : t("setPin")}
                </Text>
              </Pressable>
              {hasPin ? (
                <Pressable
                  disabled={busy}
                  onPress={() => void removePin()}
                  className="rounded-xl border border-red-200 bg-red-50 py-4"
                >
                  <Text className="text-center font-semibold text-red-700">{t("removePin")}</Text>
                </Pressable>
              ) : null}
              <Text className="text-center text-xs text-slate-500">{t("forgotPinHint")}</Text>
            </View>
          ) : null}

          {step === "current" ? (
            <View className="rounded-xl bg-white p-4">
              <Text className="mb-2 text-center font-medium text-slate-800">{t("enterCurrentPin")}</Text>
              <PinPad value={currentPin} onChange={setCurrentPin} maxLength={6} />
              <Pressable
                onPress={() => {
                  if (currentPin.length < 4) {
                    Toast.show({ type: "error", text1: t("pinTooShort") });
                    return;
                  }
                  setStep("new");
                }}
                className="mt-4 rounded-xl bg-indigo-600 py-3"
              >
                <Text className="text-center font-semibold text-white">{t("next")}</Text>
              </Pressable>
              <Pressable onPress={resetFlow} className="mt-2 py-3">
                <Text className="text-center text-slate-500">{t("cancel")}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === "new" ? (
            <View className="rounded-xl bg-white p-4">
              <Text className="mb-2 text-center font-medium text-slate-800">{t("enterNewPin")}</Text>
              <PinPad value={newPin} onChange={setNewPin} maxLength={6} />
              <Pressable
                onPress={() => {
                  if (newPin.length < 4) {
                    Toast.show({ type: "error", text1: t("pinTooShort") });
                    return;
                  }
                  setStep("confirm");
                }}
                className="mt-4 rounded-xl bg-indigo-600 py-3"
              >
                <Text className="text-center font-semibold text-white">{t("next")}</Text>
              </Pressable>
              <Pressable onPress={resetFlow} className="mt-2 py-3">
                <Text className="text-center text-slate-500">{t("cancel")}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === "confirm" ? (
            <View className="rounded-xl bg-white p-4">
              <Text className="mb-2 text-center font-medium text-slate-800">{t("confirmNewPin")}</Text>
              <PinPad value={confirmPin} onChange={setConfirmPin} maxLength={6} />
              <Pressable
                disabled={busy}
                onPress={() => void saveNewPin()}
                className="mt-4 rounded-xl bg-indigo-600 py-3"
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-center font-semibold text-white">{t("savePin")}</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setStep("new")} className="mt-2 py-3">
                <Text className="text-center text-slate-500">{t("back")}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
