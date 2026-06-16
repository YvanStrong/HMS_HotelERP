import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useKeepAwake } from "expo-keep-awake";
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Toast from "react-native-toast-message";
import { apiErrorMessage } from "../../src/api/client";
import {
  fetchKitchenBoard,
  markLineReady,
  type KitchenTicketRow,
  type TicketLine,
} from "../../src/api/tickets";
import { ScreenHeaderActions } from "../../src/components/ScreenHeaderActions";
import { usePosWebSocket } from "../../src/hooks/usePosWebSocket";
import { useAuthStore } from "../../src/store/authStore";
import { useCartStore } from "../../src/store/cartStore";

function elapsedMinutes(ticket: KitchenTicketRow): number {
  const sent = ticket.lines
    .map((l) => (l.sentAt ? new Date(l.sentAt).getTime() : 0))
    .filter((t) => t > 0);
  const base = sent.length ? Math.min(...sent) : new Date(ticket.updatedAt).getTime();
  return Math.max(0, Math.floor((Date.now() - base) / 60000));
}

function cardUrgencyClass(minutes: number): string {
  if (minutes < 5) return "bg-emerald-100 border-emerald-300";
  if (minutes <= 10) return "bg-amber-100 border-amber-300";
  return "bg-red-100 border-red-300";
}

function KitchenTicketCard({
  hotelId,
  ticket,
  columnLines,
  onRefresh,
}: {
  hotelId: string;
  ticket: KitchenTicketRow;
  columnLines: TicketLine[];
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const depot = useCartStore((s) => s.selectedDepot);
  const minutes = elapsedMinutes(ticket);
  const maxRound = Math.max(...columnLines.map((l) => l.round || 1), 1);

  const readyMut = useMutation({
    mutationFn: (lineId: string) => markLineReady(hotelId, ticket.ticketId, lineId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kitchen-board", hotelId, depot?.id] });
      onRefresh();
    },
    onError: (err) => Toast.show({ type: "error", text1: "Failed", text2: apiErrorMessage(err) }),
  });

  async function markAllReady() {
    for (const line of columnLines) {
      if (line.lineStatus === "PREPARING" || line.lineStatus === "PENDING") {
        await markLineReady(hotelId, ticket.ticketId, line.id);
      }
    }
    void queryClient.invalidateQueries({ queryKey: ["kitchen-board", hotelId, depot?.id] });
    onRefresh();
    Toast.show({ type: "success", text1: "All items marked ready" });
  }

  return (
    <View className={`mb-3 rounded-2xl border p-3 ${cardUrgencyClass(minutes)}`}>
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-bold text-slate-900">{ticket.tableLabel}</Text>
          <Text className="text-xs text-slate-600">{minutes} min elapsed</Text>
        </View>
        {maxRound > 1 ? (
          <Text className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-slate-700">
            Round {maxRound}
          </Text>
        ) : null}
      </View>
      {columnLines.map((line) => (
        <Pressable
          key={line.id}
          onPress={() => {
            if (line.lineStatus === "PREPARING" || line.lineStatus === "PENDING") {
              readyMut.mutate(line.id);
            }
          }}
          className="mb-2 rounded-xl bg-white/90 p-2"
        >
          <Text className="font-semibold text-slate-900">
            {line.quantity}× {line.productName}
          </Text>
          {line.notes ? <Text className="text-xs text-slate-500">{line.notes}</Text> : null}
        </Pressable>
      ))}
      {columnLines.some((l) => l.lineStatus === "PREPARING" || l.lineStatus === "PENDING") ? (
        <Pressable onPress={() => void markAllReady()} className="mt-1 rounded-lg bg-slate-900 py-2">
          <Text className="text-center text-xs font-bold text-white">ALL READY</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function KitchenColumn({
  title,
  cards,
  hotelId,
  onRefresh,
  compact,
}: {
  title: string;
  cards: { ticket: KitchenTicketRow; lines: TicketLine[] }[];
  hotelId: string;
  onRefresh: () => void;
  compact: boolean;
}) {
  return (
    <View className={compact ? "mb-5 w-full" : "mr-3 w-80 shrink-0"}>
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</Text>
      {cards.length === 0 ? (
        <Text className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
          No items
        </Text>
      ) : (
        cards.map(({ ticket, lines }) => (
          <KitchenTicketCard
            key={`${ticket.ticketId}-${lines.map((l) => l.id).join("-")}`}
            hotelId={hotelId}
            ticket={ticket}
            columnLines={lines}
            onRefresh={onRefresh}
          />
        ))
      )}
    </View>
  );
}

export default function KitchenScreen() {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const compact = width < 768;
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const depot = useCartStore((s) => s.selectedDepot);
  const [wsLive, setWsLive] = useState(false);

  const { data: board = [], isLoading, refetch } = useQuery({
    queryKey: ["kitchen-board", hotelId, depot?.id],
    queryFn: () => fetchKitchenBoard(hotelId, depot!.id),
    enabled: !!hotelId && !!depot?.id,
    refetchInterval: wsLive ? false : 10000,
  });

  const onWsMessage = useCallback(() => {
    void refetch();
  }, [refetch]);

  usePosWebSocket(
    hotelId,
    depot?.id ? [`/topic/hotel/${hotelId}/pos/kitchen`] : [],
    onWsMessage,
    !!depot?.id,
    setWsLive,
  );

  const columns = useMemo(() => {
    const pending: { ticket: KitchenTicketRow; lines: TicketLine[] }[] = [];
    const preparing: { ticket: KitchenTicketRow; lines: TicketLine[] }[] = [];
    const ready: { ticket: KitchenTicketRow; lines: TicketLine[] }[] = [];
    for (const ticket of board) {
      const p = ticket.lines.filter((l) => l.lineStatus === "PENDING");
      const pr = ticket.lines.filter((l) => l.lineStatus === "PREPARING");
      const r = ticket.lines.filter((l) => l.lineStatus === "READY");
      if (p.length) pending.push({ ticket, lines: p });
      if (pr.length) preparing.push({ ticket, lines: pr });
      if (r.length) ready.push({ ticket, lines: r });
    }
    return { pending, preparing, ready };
  }, [board]);

  if (!depot) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-center text-slate-600">Select an outlet to view the kitchen board.</Text>
      </View>
    );
  }

  const columnProps = { hotelId, onRefresh: () => void refetch(), compact };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-12">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-bold text-slate-900">Kitchen</Text>
            <Text className="text-sm text-slate-500" numberOfLines={1}>
              {depot.name}
            </Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <View className={`h-2 w-2 rounded-full ${wsLive ? "bg-emerald-500" : "bg-slate-400"}`} />
              <Text className="text-[11px] text-slate-500">{wsLive ? "Live" : "Polling"}</Text>
            </View>
          </View>
          <ScreenHeaderActions />
        </View>
      </View>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : compact ? (
        <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
          <KitchenColumn title="New orders" cards={columns.pending} {...columnProps} />
          <KitchenColumn title="Preparing" cards={columns.preparing} {...columnProps} />
          <KitchenColumn title="Ready" cards={columns.ready} {...columnProps} />
        </ScrollView>
      ) : (
        <ScrollView horizontal className="flex-1 px-4 py-4" showsHorizontalScrollIndicator={false}>
          <KitchenColumn title="New orders" cards={columns.pending} {...columnProps} />
          <KitchenColumn title="Preparing" cards={columns.preparing} {...columnProps} />
          <KitchenColumn title="Ready" cards={columns.ready} {...columnProps} />
        </ScrollView>
      )}
    </View>
  );
}
