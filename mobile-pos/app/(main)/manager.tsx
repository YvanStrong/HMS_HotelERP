import { useQuery } from "@tanstack/react-query";

import { useRouter } from "expo-router";

import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { fetchDailySummary } from "../../src/api/manager";

import { fetchPosTables } from "../../src/api/tickets";

import { money } from "../../src/api/tickets";

import { fetchDepots } from "../../src/api/depots";

import { useAuthStore } from "../../src/store/authStore";



const MANAGER_ROLES = new Set(["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"]);



export default function ManagerScreen() {

  const router = useRouter();

  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";

  const role = useAuthStore((s) => s.user?.role?.toUpperCase() ?? "");



  const { data: summary, isLoading } = useQuery({

    queryKey: ["pos-daily-summary", hotelId],

    queryFn: () => fetchDailySummary(hotelId),

    enabled: !!hotelId && MANAGER_ROLES.has(role),

    refetchInterval: 30000,

  });



  const { data: depots = [] } = useQuery({

    queryKey: ["depots", hotelId],

    queryFn: () => fetchDepots(hotelId),

    enabled: !!hotelId && MANAGER_ROLES.has(role),

  });



  const { data: allTables = [] } = useQuery({

    queryKey: ["manager-tables", hotelId, depots.map((d) => d.id).join(",")],

    queryFn: async () => {

      const rows = await Promise.all(depots.map((d) => fetchPosTables(hotelId, d.id)));

      return depots.flatMap((d, i) =>

        rows[i].map((t) => ({ ...t, depotName: d.name, depotId: d.id })),

      );

    },

    enabled: !!hotelId && depots.length > 0 && MANAGER_ROLES.has(role),

    refetchInterval: 10000,

  });



  if (!MANAGER_ROLES.has(role)) {

    return (

      <View className="flex-1 items-center justify-center bg-slate-50 px-6">

        <Text className="text-center text-slate-600">Manager dashboard is for hotel admin only.</Text>

      </View>

    );

  }



  return (

    <ScrollView className="flex-1 bg-slate-50">

      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-12">

        <Text className="text-xl font-bold text-slate-900">Manager</Text>

        <Text className="text-sm text-slate-500">Live floor & today&apos;s sales</Text>

      </View>



      <View className="px-4 py-4">

        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Live floor</Text>

        <View className="mb-6 flex-row flex-wrap gap-2">

          {allTables.map((t) => (

            <Pressable

              key={`${t.depotId}-${t.id}`}

              onPress={() => {

                if (t.activeTicketId) router.push(`/(main)/ticket/${t.activeTicketId}`);

              }}

              className={`min-w-[72px] rounded-xl border px-3 py-2 ${

                t.occupied ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"

              }`}

            >

              <Text className="text-center text-xs font-bold">{t.tableLabel}</Text>

              <Text className="text-center text-[10px] text-slate-500">{t.depotName}</Text>

            </Pressable>

          ))}

        </View>



        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Today&apos;s sales</Text>

        {isLoading ? (

          <ActivityIndicator color="#4f46e5" />

        ) : summary ? (

          <View className="mb-6 rounded-2xl bg-white p-4">

            <Text className="text-2xl font-bold text-indigo-600">{money(summary.totalRevenue).toFixed(2)}</Text>

            <Text className="text-sm text-slate-500">

              {summary.orderCount} orders · avg {money(summary.avgTicketValue).toFixed(2)}

            </Text>

            {summary.revenueByDepot.map((d) => (

              <Text key={d.depotId} className="mt-2 text-sm text-slate-700">

                {d.depotName}: {money(d.revenue).toFixed(2)} ({d.orderCount})

              </Text>

            ))}

            <Text className="mt-4 text-xs font-bold uppercase text-slate-500">Top items</Text>

            {summary.topItems.map((item) => (

              <Text key={item.productName} className="text-sm text-slate-600">

                {item.productName} ×{item.quantity}

              </Text>

            ))}

            <Text className="mt-4 text-xs font-bold uppercase text-slate-500">Waiters today</Text>

            {summary.waiterStats.map((w) => (

              <Text key={w.waiterId} className="text-sm text-slate-600">

                {w.waiterName}: {w.orderCount} orders · {money(w.revenue).toFixed(2)}

              </Text>

            ))}

          </View>

        ) : null}

      </View>

    </ScrollView>

  );

}


