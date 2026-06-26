import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { usePosWebSocket } from "../../src/hooks/usePosWebSocket";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { apiErrorMessage } from "../../src/api/client";
import { openTicketAction } from "../../src/api/posActions";
import { getTableReservationHint } from "../../src/api/reservations";
import { getActiveShift } from "../../src/api/shifts";
import {
  fetchPosTables,
  reassignTicket,
  type PosTableRow,
} from "../../src/api/tickets";
import { GuestCountModal } from "../../src/components/GuestCountModal";
import { ReservationHintBanner } from "../../src/components/ReservationHintBanner";
import { ScreenHeaderActions } from "../../src/components/ScreenHeaderActions";
import { ShiftHeaderBadge } from "../../src/components/ShiftHeaderBadge";
import { TablePicker } from "../../src/components/TablePicker";
import { useHeaderPadding } from "../../src/hooks/useScreenInsets";
import { useAuthStore } from "../../src/store/authStore";
import { useCartStore } from "../../src/store/cartStore";
import { useShiftStore } from "../../src/store/shiftStore";
import type { ReservationHint } from "../../src/types";

export default function TablesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const user = useAuthStore((s) => s.user);
  const headerPad = useHeaderPadding();
  const depot = useCartStore((s) => s.selectedDepot);
  const setTable = useCartStore((s) => s.setTable);
  const setActiveTicket = useCartStore((s) => s.setActiveTicket);
  const setActiveShift = useShiftStore((s) => s.setActiveShift);

  const [busy, setBusy] = useState(false);
  const [occupiedRow, setOccupiedRow] = useState<PosTableRow | null>(null);
  const [pendingRow, setPendingRow] = useState<PosTableRow | null>(null);
  const [reservationHint, setReservationHint] = useState<ReservationHint | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showGuestCount, setShowGuestCount] = useState(false);
  const [linkReservation, setLinkReservation] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    void getActiveShift(hotelId).then((shift) => {
      if (shift) setActiveShift(shift);
    }).catch(() => {});
  }, [hotelId, setActiveShift]);

  const refreshTables = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["pos-tables", hotelId, depot?.id] });
  }, [queryClient, hotelId, depot?.id]);

  const { data: tables = [], isLoading, error, refetch } = useQuery({
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
        <Text allowFontScaling={false} className="mb-4 text-center text-slate-700">{t("selectOutletFirst")}</Text>
        <Pressable
          onPress={() => router.push("/(main)/outlets")}
          className="min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-3"
        >
          <Text allowFontScaling={false} className="font-semibold text-white">{t("chooseOutlet")}</Text>
        </Pressable>
      </View>
    );
  }

  async function beginTableOpen(row: PosTableRow) {
    setPendingRow(row);
    setBusy(true);
    try {
      const hint = await getTableReservationHint(hotelId, row.id);
      if (hint) {
        setReservationHint(hint);
        setShowReservationModal(true);
      } else {
        setLinkReservation(false);
        setShowGuestCount(true);
      }
    } catch {
      setLinkReservation(false);
      setShowGuestCount(true);
    } finally {
      setBusy(false);
    }
  }

  async function startTable(
    row: PosTableRow,
    guestCount: number,
    withReservation: boolean,
    hint?: ReservationHint | null,
  ) {
    if (!depot) return;
    setBusy(true);
    try {
      setTable(row.tableLabel, row.id);
      const ticket = await openTicketAction(hotelId, {
        depotId: depot.id,
        tableLabel: row.tableLabel,
        tableId: row.id,
        guestCount,
        customerName: withReservation && hint ? hint.guestName : undefined,
        reservationId: withReservation && hint ? hint.reservationId : undefined,
      });
      setActiveTicket(ticket.id, ticket.status, ticket.currentRound);
      await queryClient.invalidateQueries({ queryKey: ["pos-tables", hotelId, depot.id] });
      setShowGuestCount(false);
      setShowReservationModal(false);
      setPendingRow(null);
      setReservationHint(null);
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
  const myLabel = user?.username || user?.email || "";
  const canTakeOver =
    occupiedRow?.activeTicketId &&
    occupiedRow.waiterName &&
    !occupiedRow.waiterName.toLowerCase().includes(myLabel.toLowerCase()) &&
    myLabel.length > 0;

  async function handleTakeOver() {
    if (!occupiedRow?.activeTicketId) return;
    Alert.alert(
      "Take over this table?",
      `Take ownership of Table ${occupiedRow.tableLabel} from ${occupiedRow.waiterName ?? "waiter"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take Over",
          onPress: () => {
            void (async () => {
              if (!user?.id) return;
              setBusy(true);
              try {
                await reassignTicket(hotelId, occupiedRow.activeTicketId!, user.id);
                setTable(occupiedRow.tableLabel, occupiedRow.id);
                setActiveTicket(occupiedRow.activeTicketId!, "OPEN");
                setOccupiedRow(null);
                Toast.show({ type: "success", text1: `You now own Table ${occupiedRow.tableLabel}` });
                router.push(`/(main)/ticket/${occupiedRow.activeTicketId}`);
              } catch (err) {
                Toast.show({ type: "error", text1: "Take over failed", text2: apiErrorMessage(err) });
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text allowFontScaling={false} className="text-xl font-bold text-slate-900">{depot.name}</Text>
            <Text allowFontScaling={false} className="text-sm text-slate-600">{t("tapTableOpen")}</Text>
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
        ) : error ? (
          <View className="flex-1 items-center justify-center">
            <Text allowFontScaling={false} className="mb-4 text-center text-red-600">
              {t("loadTablesError")}
            </Text>
            <Pressable
              onPress={() => void refetch()}
              className="min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-3"
            >
              <Text allowFontScaling={false} className="font-semibold text-white">{t("retry")}</Text>
            </Pressable>
          </View>
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
              void beginTableOpen(row);
            }}
            onWalkIn={goCounter}
          />
        )}
      </View>

      <Modal visible={!!occupiedRow} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-2xl bg-white p-5">
            <Text allowFontScaling={false} className="text-lg font-bold text-slate-900">
              {t("tableOccupied", { label: occupiedRow?.tableLabel })}
            </Text>
            {occupiedRow?.waiterName ? (
              <Text className="mt-1 text-sm text-slate-500">Waiter: {occupiedRow.waiterName}</Text>
            ) : null}
            <Pressable
              className="mt-4 min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 py-3"
              onPress={() => {
                if (!occupiedRow?.activeTicketId) return;
                setTable(occupiedRow.tableLabel, occupiedRow.id);
                setActiveTicket(occupiedRow.activeTicketId, "OPEN");
                setOccupiedRow(null);
                router.push(`/(main)/ticket/${occupiedRow.activeTicketId}`);
              }}
            >
              <Text allowFontScaling={false} className="text-center font-semibold text-white">{t("viewTicket")}</Text>
            </Pressable>
            {canTakeOver ? (
              <Pressable
                className="mt-2 min-h-[44px] items-center justify-center rounded-xl border border-indigo-200 py-3"
                onPress={() => void handleTakeOver()}
              >
                <Text allowFontScaling={false} className="text-center font-semibold text-indigo-700">
                  {t("takeOverTable")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              className="mt-2 min-h-[44px] items-center justify-center rounded-xl py-3"
              onPress={() => setOccupiedRow(null)}
            >
              <Text allowFontScaling={false} className="text-center font-medium text-slate-700">{t("cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ReservationHintBanner
        visible={showReservationModal}
        hint={reservationHint}
        onOpenLinked={() => {
          setLinkReservation(true);
          setShowReservationModal(false);
          setShowGuestCount(true);
        }}
        onOpenWithoutLink={() => {
          setLinkReservation(false);
          setShowReservationModal(false);
          setShowGuestCount(true);
        }}
        onClose={() => {
          setShowReservationModal(false);
          setPendingRow(null);
          setReservationHint(null);
        }}
      />

      <GuestCountModal
        visible={showGuestCount && !!pendingRow}
        defaultCount={linkReservation && reservationHint ? reservationHint.guestCount : 1}
        onSelect={(count) => {
          if (pendingRow) void startTable(pendingRow, count, linkReservation, reservationHint);
        }}
        onSkip={() => {
          if (pendingRow) void startTable(pendingRow, 1, linkReservation, reservationHint);
        }}
      />

      {busy ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : null}
    </View>
  );
}
