import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useKeepAwake } from "expo-keep-awake";
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { apiErrorMessage } from "../../src/api/client";
import {
  fetchKitchenBoard,
  markLineReady,
  markLineServed,
  type KitchenTicketRow,
  type TicketLine,
} from "../../src/api/tickets";
import { ScreenHeaderActions } from "../../src/components/ScreenHeaderActions";
import { useHeaderPadding, useBottomPadding } from "../../src/hooks/useScreenInsets";
import { usePosWebSocket } from "../../src/hooks/usePosWebSocket";
import { useAuthStore } from "../../src/store/authStore";
import { useCartStore } from "../../src/store/cartStore";

type ColumnMode = "prep" | "ready";

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

function courseLabel(course: string | null | undefined, t: (k: string) => string): string {
  if (!course) return "";
  const map: Record<string, string> = {
    STARTER: t("courseStarter"),
    MAIN: t("courseMain"),
    DESSERT: t("courseDessert"),
  };
  return map[course] ?? course;
}

function HeldKitchenCard({
  ticket,
  lines,
  t,
}: {
  ticket: KitchenTicketRow;
  lines: TicketLine[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <View className="mb-3 rounded-2xl border border-dashed border-slate-400 bg-slate-200/80 p-3">
      <Text allowFontScaling={false} className="mb-2 text-lg font-bold text-slate-700">
        {ticket.tableLabel}
      </Text>
      {lines.map((line) => (
        <View key={line.id} className="mb-2 rounded-xl border border-slate-300 bg-slate-100 p-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text allowFontScaling={true} className="flex-1 font-medium text-slate-700">
              {line.quantity}× {line.productName}
            </Text>
            <Text allowFontScaling={false} className="rounded bg-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {t("held")}
            </Text>
          </View>
          {line.holdCourse ? (
            <Text allowFontScaling={false} className="mt-1 text-xs font-medium text-slate-600">
              {courseLabel(line.holdCourse, t)}
            </Text>
          ) : null}
          {line.notes ? (
            <Text allowFontScaling={true} className="text-xs text-slate-600">{line.notes}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function KitchenHeldColumn({
  title,
  cards,
  compact,
  t,
}: {
  title: string;
  cards: { ticket: KitchenTicketRow; lines: TicketLine[] }[];
  compact: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <View className={compact ? "mb-5 w-full" : "mr-3 w-80 shrink-0"}>
      <Text allowFontScaling={false} className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        {title}
      </Text>
      {cards.length === 0 ? (
        <Text allowFontScaling={false} className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-xs text-slate-500">
          {t("noItems")}
        </Text>
      ) : (
        cards.map(({ ticket, lines }) => (
          <HeldKitchenCard key={`held-${ticket.ticketId}`} ticket={ticket} lines={lines} t={t} />
        ))
      )}
    </View>
  );
}

function KitchenTicketCard({
  hotelId,
  ticket,
  columnLines,
  columnMode,
  onRefresh,
  t,
}: {
  hotelId: string;
  ticket: KitchenTicketRow;
  columnLines: TicketLine[];
  columnMode: ColumnMode;
  onRefresh: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const queryClient = useQueryClient();
  const depot = useCartStore((s) => s.selectedDepot);
  const minutes = elapsedMinutes(ticket);
  const maxRound = Math.max(...columnLines.map((l) => l.round || 1), 1);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["kitchen-board", hotelId, depot?.id] });
    onRefresh();
  };

  const readyMut = useMutation({
    mutationFn: (lineId: string) => markLineReady(hotelId, ticket.ticketId, lineId),
    onSuccess: invalidate,
    onError: (err) => Toast.show({ type: "error", text1: "Failed", text2: apiErrorMessage(err) }),
  });

  const servedMut = useMutation({
    mutationFn: (lineId: string) => markLineServed(hotelId, ticket.ticketId, lineId),
    onSuccess: invalidate,
    onError: (err) => Toast.show({ type: "error", text1: "Failed", text2: apiErrorMessage(err) }),
  });

  async function markAllReady() {
    for (const line of columnLines) {
      if (line.lineStatus === "PREPARING" || line.lineStatus === "PENDING") {
        await markLineReady(hotelId, ticket.ticketId, line.id);
      }
    }
    invalidate();
    Toast.show({ type: "success", text1: "All items marked ready" });
  }

  async function markAllServed() {
    for (const line of columnLines) {
      if (line.lineStatus === "READY") {
        await markLineServed(hotelId, ticket.ticketId, line.id);
      }
    }
    invalidate();
    Toast.show({ type: "success", text1: "All items marked served" });
  }

  const isReadyColumn = columnMode === "ready";

  return (
    <View className={`mb-3 rounded-2xl border p-3 ${cardUrgencyClass(minutes)}`}>
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text allowFontScaling={false} className="text-lg font-bold text-slate-900">{ticket.tableLabel}</Text>
          <Text allowFontScaling={false} className="text-xs text-slate-700">
            {t("minElapsed", { n: minutes })}
          </Text>
        </View>
        {maxRound > 1 ? (
          <Text allowFontScaling={false} className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-slate-700">
            {t("round", { n: maxRound })}
          </Text>
        ) : null}
      </View>
      {columnLines.map((line) => (
        <Pressable
          key={line.id}
          onPress={() => {
            if (isReadyColumn && line.lineStatus === "READY") {
              servedMut.mutate(line.id);
            } else if (!isReadyColumn && (line.lineStatus === "PREPARING" || line.lineStatus === "PENDING")) {
              readyMut.mutate(line.id);
            }
          }}
          className="mb-2 min-h-[44px] rounded-xl bg-white/90 p-2"
        >
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              <Text allowFontScaling={true} className="font-semibold text-slate-900">
                {line.quantity}× {line.productName}
              </Text>
              {line.notes ? (
                <Text allowFontScaling={true} className="text-xs text-slate-600">{line.notes}</Text>
              ) : null}
            </View>
            {isReadyColumn && line.lineStatus === "READY" ? (
              <Text allowFontScaling={false} className="text-xs font-bold text-emerald-800">{t("served")}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}
      {!isReadyColumn &&
      columnLines.some((l) => l.lineStatus === "PREPARING" || l.lineStatus === "PENDING") ? (
        <Pressable onPress={() => void markAllReady()} className="mt-1 min-h-[44px] items-center justify-center rounded-lg bg-slate-900 py-2">
          <Text allowFontScaling={false} className="text-center text-xs font-bold text-white">{t("allReady")}</Text>
        </Pressable>
      ) : null}
      {isReadyColumn && columnLines.some((l) => l.lineStatus === "READY") ? (
        <Pressable onPress={() => void markAllServed()} className="mt-1 min-h-[44px] items-center justify-center rounded-lg bg-emerald-700 py-2">
          <Text allowFontScaling={false} className="text-center text-xs font-bold text-white">{t("allServed")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function KitchenColumn({
  title,
  cards,
  hotelId,
  columnMode,
  onRefresh,
  compact,
  t,
}: {
  title: string;
  cards: { ticket: KitchenTicketRow; lines: TicketLine[] }[];
  hotelId: string;
  columnMode: ColumnMode;
  onRefresh: () => void;
  compact: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <View className={compact ? "mb-5 w-full" : "mr-3 w-80 shrink-0"}>
      <Text allowFontScaling={false} className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        {title}
      </Text>
      {cards.length === 0 ? (
        <Text allowFontScaling={false} className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-xs text-slate-500">
          {t("noItems")}
        </Text>
      ) : (
        cards.map(({ ticket, lines }) => (
          <KitchenTicketCard
            key={`${ticket.ticketId}-${lines.map((l) => l.id).join("-")}`}
            hotelId={hotelId}
            ticket={ticket}
            columnLines={lines}
            columnMode={columnMode}
            onRefresh={onRefresh}
            t={t}
          />
        ))
      )}
    </View>
  );
}

export default function KitchenScreen() {
  useKeepAwake();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const compact = width < 768;
  const headerPad = useHeaderPadding();
  const bottomPad = useBottomPadding(8);
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const depot = useCartStore((s) => s.selectedDepot);
  const [wsLive, setWsLive] = useState(false);

  const { data: board = [], isLoading, error, refetch } = useQuery({
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
    const held: { ticket: KitchenTicketRow; lines: TicketLine[] }[] = [];
    const preparing: { ticket: KitchenTicketRow; lines: TicketLine[] }[] = [];
    const ready: { ticket: KitchenTicketRow; lines: TicketLine[] }[] = [];
    for (const ticket of board) {
      const heldLines = ticket.lines.filter((l) => l.held && l.lineStatus === "PENDING");
      const p = ticket.lines.filter((l) => l.lineStatus === "PENDING" && !l.held);
      const pr = ticket.lines.filter((l) => l.lineStatus === "PREPARING");
      const r = ticket.lines.filter((l) => l.lineStatus === "READY");
      if (heldLines.length) held.push({ ticket, lines: heldLines });
      if (p.length) pending.push({ ticket, lines: p });
      if (pr.length) preparing.push({ ticket, lines: pr });
      if (r.length) ready.push({ ticket, lines: r });
    }
    return { pending, held, preparing, ready };
  }, [board]);

  if (!depot) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text allowFontScaling={false} className="text-center text-slate-700">{t("kitchenSelectOutlet")}</Text>
      </View>
    );
  }

  const columnProps = { hotelId, onRefresh: () => void refetch(), compact, t };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text allowFontScaling={false} className="text-xl font-bold text-slate-900">{t("kitchen")}</Text>
            <Text allowFontScaling={true} className="text-sm text-slate-600" numberOfLines={1}>
              {depot.name}
            </Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <View className={`h-2 w-2 rounded-full ${wsLive ? "bg-emerald-500" : "bg-slate-400"}`} />
              <Text allowFontScaling={false} className="text-[11px] text-slate-600">
                {wsLive ? t("live") : t("polling")}
              </Text>
            </View>
          </View>
          <ScreenHeaderActions />
        </View>
      </View>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text allowFontScaling={false} className="mb-4 text-center text-red-600">{t("loadKitchenError")}</Text>
          <Pressable
            onPress={() => void refetch()}
            className="min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-3"
          >
            <Text allowFontScaling={false} className="font-semibold text-white">{t("retry")}</Text>
          </Pressable>
        </View>
      ) : compact ? (
        <ScrollView
          className="flex-1 px-4 py-4"
          style={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          <KitchenColumn title={t("newOrders")} cards={columns.pending} columnMode="prep" {...columnProps} />
          <KitchenHeldColumn title={t("heldNotFired")} cards={columns.held} compact={compact} t={t} />
          <KitchenColumn title={t("preparing")} cards={columns.preparing} columnMode="prep" {...columnProps} />
          <KitchenColumn title={t("ready")} cards={columns.ready} columnMode="ready" {...columnProps} />
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          className="flex-1 px-4 py-4"
          style={{ paddingBottom: bottomPad }}
          showsHorizontalScrollIndicator={false}
        >
          <KitchenColumn title={t("newOrders")} cards={columns.pending} columnMode="prep" {...columnProps} />
          <KitchenHeldColumn title={t("heldNotFired")} cards={columns.held} compact={compact} t={t} />
          <KitchenColumn title={t("preparing")} cards={columns.preparing} columnMode="prep" {...columnProps} />
          <KitchenColumn title={t("ready")} cards={columns.ready} columnMode="ready" {...columnProps} />
        </ScrollView>
      )}
    </View>
  );
}
