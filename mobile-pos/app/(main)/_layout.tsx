import { Tabs } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { View } from "react-native";

import { ModuleGate } from "../../src/components/ModuleGate";

import { OfflineBanner } from "../../src/components/OfflineBanner";

import { useOfflineSync } from "../../src/hooks/useOfflineSync";

import { useAuthStore } from "../../src/store/authStore";



const MANAGER_ROLES = new Set(["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"]);



export default function MainLayout() {

  useOfflineSync();

  const role = useAuthStore((s) => s.user?.role?.toUpperCase() ?? "");

  const showManager = MANAGER_ROLES.has(role);



  return (

    <ModuleGate>

    <View className="flex-1">

      <OfflineBanner />

      <Tabs

        screenOptions={{

          headerShown: false,

          tabBarActiveTintColor: "#4f46e5",

          tabBarInactiveTintColor: "#94a3b8",

        }}

      >

        <Tabs.Screen

          name="outlets"

          options={{

            title: "Outlet",

            tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,

          }}

        />

        <Tabs.Screen

          name="tables"

          options={{

            title: "Tables",

            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,

          }}

        />

        <Tabs.Screen

          name="kitchen"

          options={{

            title: "Kitchen",

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

            title: "Order",

            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,

          }}

        />

        <Tabs.Screen

          name="ticket/[ticketId]"

          options={{ href: null }}

        />

        <Tabs.Screen

          name="manager"

          options={{

            title: "Manager",

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


