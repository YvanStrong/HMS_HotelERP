import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PinPad } from "./PinPad";
import { fetchHasPin, pinUnlock } from "../api/pinAuth";
import { apiErrorMessage } from "../api/client";
import { bumpSessionActivity, idleMsSinceLastActivity, LOCK_MS } from "../lib/sessionActivity";
import { useAuthStore } from "../store/authStore";

export function SessionLock() {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(false);
  const [usePin, setUsePin] = useState(true);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const setTokens = useAuthStore((s) => s.setTokens);

  useEffect(() => {
    bumpSessionActivity();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        bumpSessionActivity();
        return;
      }
      if (state === "active" && idleMsSinceLastActivity() > LOCK_MS) {
        void (async () => {
          if (!user?.hotelId) return;
          const pinOk = await fetchHasPin(user.hotelId);
          setUsePin(pinOk);
          setEmail(user.email ?? "");
          setLocked(true);
        })();
      }
    });
    return () => sub.remove();
  }, [user?.email, user?.hotelId]);

  async function unlockWithPin(entered: string) {
    if (!user?.hotelId || !user.email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await pinUnlock(user.hotelId, user.email, entered);
      await setTokens(res.accessToken, res.refreshToken, res.user);
      setPin("");
      setLocked(false);
      bumpSessionActivity();
    } catch (err) {
      setError(apiErrorMessage(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithPassword() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      setPassword("");
      setLocked(false);
      bumpSessionActivity();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!locked || !user) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-indigo-950/95 px-6">
        {usePin ? (
          <>
            <Text className="mb-1 text-xl font-bold text-white">Session locked</Text>
            <Text className="mb-6 text-indigo-200">Enter your PIN to continue</Text>
            <PinPad
              value={pin}
              onChange={setPin}
              maxLength={6}
              onComplete={(p) => void unlockWithPin(p)}
            />
            <Pressable
              disabled={busy || pin.length < 4}
              onPress={() => void unlockWithPin(pin)}
              className={`mt-4 w-full rounded-xl py-3 ${pin.length >= 4 ? "bg-indigo-600" : "bg-indigo-800/50"}`}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-center font-semibold text-white">{t("signIn")}</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text className="mb-1 text-xl font-bold text-white">Session expired for security</Text>
            <Text className="mb-6 text-center text-indigo-200">Please verify your account to continue.</Text>
            <TextInput
              className="mb-3 w-full rounded-xl border border-indigo-700 bg-indigo-900 px-4 py-3 text-white"
              placeholder="Email"
              placeholderTextColor="#a5b4fc"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="mb-3 w-full rounded-xl border border-indigo-700 bg-indigo-900 px-4 py-3 text-white"
              placeholder="Password"
              placeholderTextColor="#a5b4fc"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              disabled={busy}
              onPress={() => void unlockWithPassword()}
              className="w-full rounded-xl bg-indigo-600 py-3"
            >
              <Text className="text-center font-semibold text-white">{busy ? "Verifying…" : "Verify"}</Text>
            </Pressable>
          </>
        )}
        {error ? <Text className="mt-4 text-center text-sm text-red-300">{error}</Text> : null}
        {busy && usePin ? <Text className="mt-2 text-sm text-indigo-200">Unlocking…</Text> : null}
        <Pressable className="mt-8" onPress={() => void useAuthStore.getState().logout()}>
          <Text className="text-center font-medium text-indigo-200">Sign out</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
