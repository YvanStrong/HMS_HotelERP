import { Pressable, Text, View } from "react-native";
import type { PosAnnouncement, AnnouncementType } from "../api/announcements";

const STYLES: Record<AnnouncementType, { bg: string; text: string; icon: string }> = {
  URGENT: { bg: "bg-red-600", text: "text-white", icon: "⚠️" },
  WARNING: { bg: "bg-orange-500", text: "text-white", icon: "⚠️" },
  INFO: { bg: "bg-blue-600", text: "text-white", icon: "ℹ️" },
};

type Props = {
  items: PosAnnouncement[];
  onDismiss: (id: string) => void;
};

export function AnnouncementBannerStack({ items, onDismiss }: Props) {
  const visible = items.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <View className="mb-3 gap-2">
      {visible.map((a) => {
        const style = STYLES[a.type] ?? STYLES.INFO;
        return (
          <View key={a.id} className={`flex-row items-start rounded-xl px-3 py-2 ${style.bg}`}>
            <Text className={`flex-1 text-sm font-medium ${style.text}`}>
              {style.icon} {a.type} · {a.message}
            </Text>
            <Pressable onPress={() => onDismiss(a.id)} hitSlop={8} className="ml-2 px-1">
              <Text className={`text-lg font-bold ${style.text}`}>×</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
