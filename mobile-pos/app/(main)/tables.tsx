import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { usePosWebSocket } from "../../src/hooks/usePosWebSocket";

import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";

import Toast from "react-native-toast-message";

import { apiErrorMessage } from "../../src/api/client";

import { openTicketAction } from "../../src/api/posActions";
import { getActiveShift } from "../../src/api/shifts";
import { fetchPosTables, type PosTableRow } from "../../src/api/tickets";

import { ScreenHeaderActions } from "../../src/components/ScreenHeaderActions";
import { ShiftHeaderBadge } from "../../src/components/ShiftHeaderBadge";
import { TablePicker } from "../../src/components/TablePicker";

import { useAuthStore } from "../../src/store/authStore";

import { useCartStore } from "../../src/store/cartStore";
import { useShiftStore } from "../../src/store/shiftStore";



export default function TablesScreen() {

  const router = useRouter();

  const queryClient = useQueryClient();

  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";

  const depot = useCartStore((s) => s.selectedDepot);

  const setTable = useCartStore((s) => s.setTable);

  const setActiveTicket = useCartStore((s) => s.setActiveTicket);
  const setActiveShift = useShiftStore((s) => s.setActiveShift);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    void getActiveShift(hotelId).then((shift) => {
      if (shift) setActiveShift(shift);
    });
  }, [hotelId, setActiveShift]);

  const [occupiedRow, setOccupiedRow] = useState<PosTableRow | null>(null);



  const refreshTables = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["pos-tables", hotelId, depot?.id] });
  }, [queryClient, hotelId, depot?.id]);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["pos-tables", hotelId, depot?.id],
    queryFn: () => fetchPosTables(hotelId, depot!.id),
    enabled: !!hotelId && !!depot?.id,
    refetchInterval: 15000,
  });

  usePosWebSocket(
    hotelId,
    hotelId ? [`/topic/hotel/${hotelId}/pos/tables`] : [],
    refreshTables,
    !!hotelId && !!depot?.id,
  );



  if (!depot) {

    return (

      <View className="flex-1 items-center justify-center bg-slate-50 px-6">

        <Text className="mb-4 text-center text-slate-600">Select an outlet first.</Text>

        <Pressable onPress={() => router.push("/(main)/outlets")} className="rounded-xl bg-indigo-600 px-4 py-3">

          <Text className="font-semibold text-white">Choose outlet</Text>

        </Pressable>

      </View>

    );

  }



  async function startTable(row: PosTableRow) {

    if (!depot) return;

    setBusy(true);

    try {

      setTable(row.tableLabel, row.id);

      const ticket = await openTicketAction(hotelId, {

        depotId: depot.id,

        tableLabel: row.tableLabel,

        tableId: row.id,

      });

      setActiveTicket(ticket.id, ticket.status, ticket.currentRound);

      await queryClient.invalidateQueries({ queryKey: ["pos-tables", hotelId, depot.id] });

      router.push(`/(main)/menu/${depot.id}`);

    } catch (err) {

      Toast.show({ type: "error", text1: "Could not open table", text2: apiErrorMessage(err) });

    } finally {

      setBusy(false);

    }

  }



  function goCounter() {

    if (!depot) return;

    setTable("Counter");

    router.push(`/(main)/menu/${depot.id}`);

  }



  const occupied = new Set(tables.filter((t) => t.occupied).map((t) => t.tableLabel));



  return (

    <View className="flex-1 bg-slate-50">

      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-12">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-900">{depot.name}</Text>
            <Text className="text-sm text-slate-500">Tap a table to open a ticket</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <ShiftHeaderBadge variant="duration" />
            <ScreenHeaderActions />
          </View>
        </View>
      </View>

      <View className="flex-1 px-4 py-4">

        {isLoading ? (

          <ActivityIndicator color="#4f46e5" />

        ) : (

          <TablePicker

            tables={tables.map((t) => t.tableLabel)}

            occupied={occupied}

            onSelect={(table) => {

              const row = tables.find((t) => t.tableLabel === table);

              if (!row) return;

              if (row.occupied && row.activeTicketId) {

                setOccupiedRow(row);

                return;

              }

              void startTable(row);

            }}

            onWalkIn={goCounter}

          />

        )}

      </View>



      <Modal visible={!!occupiedRow} transparent animationType="fade">

        <View className="flex-1 items-center justify-center bg-black/40 px-6">

          <View className="w-full rounded-2xl bg-white p-5">

            <Text className="text-lg font-bold text-slate-900">{occupiedRow?.tableLabel} is occupied</Text>

            {occupiedRow?.waiterName ? (

              <Text className="mt-1 text-sm text-slate-500">Waiter: {occupiedRow.waiterName}</Text>

            ) : null}

            <Pressable

              className="mt-4 rounded-xl bg-indigo-600 py-3"

              onPress={() => {

                if (!occupiedRow?.activeTicketId || !depot) return;

                setTable(occupiedRow.tableLabel, occupiedRow.id);

                setActiveTicket(occupiedRow.activeTicketId, "OPEN");

                setOccupiedRow(null);

                router.push(`/(main)/ticket/${occupiedRow.activeTicketId}`);

              }}

            >

              <Text className="text-center font-semibold text-white">View ticket</Text>

            </Pressable>

            <Pressable className="mt-2 rounded-xl py-3" onPress={() => setOccupiedRow(null)}>

              <Text className="text-center font-medium text-slate-600">Cancel</Text>

            </Pressable>

          </View>

        </View>

      </Modal>



      {busy ? (

        <View className="absolute inset-0 items-center justify-center bg-black/20">

          <ActivityIndicator size="large" color="#4f46e5" />

        </View>

      ) : null}

    </View>

  );

}

