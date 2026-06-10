import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";

type Props = {
  showSettings?: boolean;
  showLogout?: boolean;
};

export function ScreenHeaderActions({ showSettings = true, showLogout = false }: Props) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View className="flex-row items-center gap-1">
      {showSettings ? (
        <Pressable
          onPress={() => router.push("/(main)/printer-settings")}
          hitSlop={8}
          className="rounded-full bg-slate-100 p-2"
        >
          <Ionicons name="settings-outline" size={20} color="#64748b" />
        </Pressable>
      ) : null}
      {showLogout ? (
        <Pressable onPress={() => void logout()} hitSlop={8} className="rounded-full bg-slate-100 p-2">
          <Ionicons name="log-out-outline" size={20} color="#64748b" />
        </Pressable>
      ) : null}
    </View>
  );
}
