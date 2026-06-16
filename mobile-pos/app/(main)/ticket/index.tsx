import { Redirect, useRouter } from "expo-router";

import { Pressable, Text, View } from "react-native";

import { useCartStore } from "../../../src/store/cartStore";



const UUID_RE =

  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;



export default function TicketIndex() {

  const router = useRouter();

  const ticketId = useCartStore((s) => s.ticketId);



  if (ticketId && UUID_RE.test(ticketId)) {

    return <Redirect href={`/(main)/ticket/${ticketId}`} />;

  }



  return (

    <View className="flex-1 items-center justify-center bg-slate-50 px-6">

      <Text className="mb-2 text-center text-lg font-semibold text-slate-900">No open ticket</Text>

      <Text className="mb-6 text-center text-slate-600">Select a table to start an order.</Text>

      <Pressable onPress={() => router.push("/(main)/tables")} className="rounded-xl bg-indigo-600 px-5 py-3">

        <Text className="font-semibold text-white">Go to tables</Text>

      </Pressable>

    </View>

  );

}

