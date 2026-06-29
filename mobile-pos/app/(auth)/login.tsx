import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { getApiBaseUrl, setApiBaseUrl } from "../../src/api/settings";
import { apiErrorMessage } from "../../src/api/client";
import { fetchHasPin, pinLogin, setPosPin } from "../../src/api/pinAuth";
import { PinPad } from "../../src/components/PinPad";
import { useAuthStore } from "../../src/store/authStore";
import { mmkvGetString } from "../../src/storage/mmkv";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const loginWithTokens = useAuthStore((s) => s.loginWithTokens);
  const savedEmail = useAuthStore((s) => s.savedEmail);

  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [mode, setMode] = useState<"pin" | "password">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setPinOpen, setSetPinOpen] = useState(false);
  const [hotelIdForPin, setHotelIdForPin] = useState<string | null>(null);

  useEffect(() => {
    const saved = savedEmail() ?? mmkvGetString("saved_email");
    if (saved) {
      setEmail(saved);
      setMode("pin");
    }
  }, [savedEmail]);

  async function onPasswordSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      await setApiBaseUrl(apiUrl);
      await login(email, password);
      Toast.show({ type: "success", text1: "Signed in" });
      const user = useAuthStore.getState().user;
      if (user?.hotelId) {
        try {
          const has = await fetchHasPin(user.hotelId);
          if (!has) {
            setHotelIdForPin(user.hotelId);
            setSetPinOpen(true);
            return;
          }
        } catch {
          // continue
        }
      }
      router.replace("/(main)/outlets");
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(msg);
      Toast.show({ type: "error", text1: "Sign in failed", text2: msg });
    } finally {
      setBusy(false);
    }
  }

  async function onPinSubmit(entered: string) {
    setError(null);
    const saved = savedEmail() ?? email;
    if (!saved.trim()) {
      setMode("password");
      return;
    }
    setBusy(true);
    try {
      await setApiBaseUrl(apiUrl);
      const hotelId = mmkvGetString("last_hotel_id");
      if (!hotelId) {
        setError("Use password login once to link this device.");
        setMode("password");
        return;
      }
      const res = await pinLogin(hotelId, saved.trim(), entered);
      await loginWithTokens(res.accessToken, res.refreshToken, res.user);
      Toast.show({ type: "success", text1: "Welcome back" });
      router.replace("/(main)/outlets");
    } catch (err) {
      setError(apiErrorMessage(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function savePin() {
    if (!hotelIdForPin || pin.length < 4 || pin !== confirmPin) {
      Toast.show({ type: "error", text1: t("pinMismatch") });
      return;
    }
    await setPosPin(hotelIdForPin, pin);
    setSetPinOpen(false);
    Toast.show({ type: "success", text1: "PIN saved" });
    router.replace("/(main)/outlets");
  }

  const displayEmail = savedEmail() ?? email;
  const initial = displayEmail ? displayEmail.charAt(0).toUpperCase() : "?";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-indigo-950"
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-8 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <Ionicons name="restaurant" size={32} color="#fff" />
          </View>
          <Text className="text-3xl font-bold text-white">HMS Waiter</Text>
        </View>

        <View className="rounded-3xl bg-white p-5">
          <Text className="mb-1 text-sm font-medium text-slate-600">Server URL</Text>
          <TextInput
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            className="mb-4 rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
          />

          {mode === "pin" && displayEmail ? (
            <>
              <View className="mb-4 items-center">
                <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
                  <Text className="text-xl font-bold text-indigo-700">{initial}</Text>
                </View>
                <Text className="font-medium text-slate-800">{displayEmail}</Text>
              </View>
              <PinPad
                value={pin}
                onChange={setPin}
                maxLength={6}
                onComplete={(p) => void onPinSubmit(p)}
              />
              <Pressable
                disabled={busy || pin.length < 4}
                onPress={() => void onPinSubmit(pin)}
                className={`mt-4 rounded-xl py-3 ${pin.length >= 4 ? "bg-indigo-600" : "bg-slate-300"}`}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-center font-semibold text-white">{t("signIn")}</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setMode("password")} className="mt-4">
                <Text className="text-center text-sm text-indigo-600">{t("forgotPinUsePassword")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode("password");
                  setEmail("");
                }}
                className="mt-2"
              >
                <Text className="text-center text-sm text-slate-500">Switch user</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                className="mb-4 rounded-xl border border-slate-200 px-4 py-3"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                className="mb-4 rounded-xl border border-slate-200 px-4 py-3"
              />
              <Pressable
                disabled={busy}
                onPress={() => void onPasswordSubmit()}
                className="rounded-xl bg-indigo-600 py-4"
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-center font-semibold text-white">Sign In</Text>
                )}
              </Pressable>
              {displayEmail ? (
                <Pressable onPress={() => setMode("pin")} className="mt-3">
                  <Text className="text-center text-sm text-indigo-600">Use PIN instead</Text>
                </Pressable>
              ) : null}
            </>
          )}

          {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}
        </View>
      </View>

      <Modal visible={setPinOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white p-6">
            <Text className="text-lg font-bold text-slate-900">Set a quick PIN?</Text>
            <Text className="mt-1 text-sm text-slate-500">{t("pinSetLoginHint")}</Text>
            <Text className="mt-4 text-sm font-medium text-slate-700">Enter PIN</Text>
            <PinPad value={pin} onChange={setPin} maxLength={6} />
            <Text className="mt-4 text-sm font-medium text-slate-700">Confirm PIN</Text>
            <PinPad value={confirmPin} onChange={setConfirmPin} maxLength={6} />
            <Pressable onPress={() => void savePin()} className="mt-4 rounded-xl bg-indigo-600 py-3">
              <Text className="text-center font-semibold text-white">Save PIN</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSetPinOpen(false);
                router.replace("/(main)/outlets");
              }}
              className="mt-2 py-3"
            >
              <Text className="text-center text-slate-500">Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
