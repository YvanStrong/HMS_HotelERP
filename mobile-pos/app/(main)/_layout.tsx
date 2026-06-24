import { Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useBottomPadding } from "../../src/hooks/useScreenInsets";
import { ModuleGate } from "../../src/components/ModuleGate";
import { OfflineBanner } from "../../src/components/OfflineBanner";
import { useOfflineSync } from "../../src/hooks/useOfflineSync";
import { useAuthStore } from "../../src/store/authStore";
import { useCartStore } from "../../src/store/cartStore";
import { fetchActiveAnnouncements } from "../../src/api/announcements";



const MANAGER_ROLES = new Set(["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"]);



export default function MainLayout() {

  useOfflineSync();
  const { t } = useTranslation();

  const role = useAuthStore((s) => s.user?.role?.toUpperCase() ?? "");
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const depotId = useCartStore((s) => s.selectedDepot?.id);

  const showManager = MANAGER_ROLES.has(role);
  const tabBarBottom = useBottomPadding();

  const { data: unreadAnnouncements = [] } = useQuery({
    queryKey: ["announcements-badge", hotelId, depotId],
    queryFn: () => fetchActiveAnnouncements(hotelId, depotId),
    enabled: !!hotelId && !!depotId,
    refetchInterval: 60_000,
  });
  const announcementCount = unreadAnnouncements.length;



  return (

    <ModuleGate>

    <View className="flex-1">

      <OfflineBanner />

      <Tabs

        screenOptions={{

          headerShown: false,

          tabBarActiveTintColor: "#4f46e5",

          tabBarInactiveTintColor: "#94a3b8",

          tabBarStyle: { paddingBottom: tabBarBottom, height: 56 + tabBarBottom },

        }}

      >

        <Tabs.Screen

          name="outlets"

          options={{

            title: t("outlet"),

            tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,

          }}

        />

        <Tabs.Screen

          name="tables"

          options={{

            title: t("tables"),

            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,

          }}

        />

        <Tabs.Screen

          name="kitchen"

          options={{

            title: t("kitchen"),

            tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} />,

          }}

        />

        <Tabs.Screen

          name="menu/[depotId]"

          options={{ href: null }}

        />

        <Tabs.Screen
          name="ticket/index"
          options={{
            title: t("order"),
            tabBarIcon: ({ color, size }) => (
              <View>
                <Ionicons name="receipt-outline" size={size} color={color} />
                {announcementCount > 0 ? (
                  <View className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-red-600 px-1">
                    <Text className="text-center text-[10px] font-bold text-white">
                      {announcementCount > 9 ? "9+" : announcementCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            ),
          }}
        />

        <Tabs.Screen

          name="ticket/[ticketId]"

          options={{ href: null }}

        />

        <Tabs.Screen

          name="manager"

          options={{

            title: t("manager"),

            href: showManager ? undefined : null,

            tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,

          }}

        />

        <Tabs.Screen name="printer-settings" options={{ href: null }} />

        <Tabs.Screen name="close-shift" options={{ href: null }} />

      </Tabs>


    </View>

    </ModuleGate>

  );

}


