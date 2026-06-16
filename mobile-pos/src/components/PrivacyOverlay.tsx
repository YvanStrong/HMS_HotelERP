import { useEffect, useState } from "react";
import { AppState, Image, Modal, Text, View } from "react-native";

/** Hides screen content when app is inactive (app switcher / background). */
export function PrivacyOverlay() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setHidden(state === "background" || state === "inactive");
    });
    return () => sub.remove();
  }, []);

  if (!hidden) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-indigo-950">
        <Image source={require("../../assets/icon.png")} className="mb-4 h-20 w-20 rounded-2xl" />
        <Text className="text-2xl font-bold text-white">HMS Waiter</Text>
        <Text className="mt-2 text-sm text-indigo-200">Session protected</Text>
      </View>
    </Modal>
  );
}
