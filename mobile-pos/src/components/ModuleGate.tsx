import { Pressable, Text, View } from "react-native";
import { useAuthStore } from "../store/authStore";

export function ModuleGate({ children }: { children: React.ReactNode }) {
  const hasModule = useAuthStore((s) => s.hasModule);
  const logout = useAuthStore((s) => s.logout);

  if (!hasModule("RESTAURANT_POS")) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-8">
        <Text className="mb-2 text-center text-lg font-bold text-slate-900">
          POS is not enabled for this property
        </Text>
        <Text className="mb-6 text-center text-sm text-slate-600">
          Contact your administrator to enable the Restaurant POS module.
        </Text>
        <Pressable onPress={() => void logout()} className="rounded-xl bg-indigo-600 px-5 py-3">
          <Text className="font-semibold text-white">Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}
