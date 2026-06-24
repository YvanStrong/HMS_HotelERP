import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { countProductsByDepot, fetchDepots, setActiveDepot } from "../../src/api/depots";
import { apiErrorMessage } from "../../src/api/client";
import { getActiveShift, openShift } from "../../src/api/shifts";
import { OpenShiftModal } from "../../src/components/OpenShiftModal";
import { OutletCard } from "../../src/components/OutletCard";
import { ScreenHeaderActions } from "../../src/components/ScreenHeaderActions";
import { ShiftHeaderBadge } from "../../src/components/ShiftHeaderBadge";
import { useHeaderPadding } from "../../src/hooks/useScreenInsets";
import { useAuthStore } from "../../src/store/authStore";
import { useCartStore } from "../../src/store/cartStore";
import { useShiftStore } from "../../src/store/shiftStore";
import { hapticError, hapticSuccess } from "../../src/lib/haptics";
import type { Depot } from "../../src/types";

export default function OutletsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setDepot = useCartStore((s) => s.setDepot);
  const setActiveShift = useShiftStore((s) => s.setActiveShift);
  const clearShift = useShiftStore((s) => s.clearShift);
  const hotelId = user?.hotelId ?? "";
  const posRequireShift = useAuthStore((s) => s.posRequireShift);
  const loadHotelSettings = useAuthStore((s) => s.loadHotelSettings);
  const headerPad = useHeaderPadding();

  const [pendingDepot, setPendingDepot] = useState<Depot | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);

  const { data: depots = [], isLoading, error, refetch } = useQuery({
    queryKey: ["depots", hotelId],
    queryFn: () => fetchDepots(hotelId),
    enabled: !!hotelId,
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["depot-product-counts", hotelId],
    queryFn: () => countProductsByDepot(hotelId),
    enabled: !!hotelId,
  });

  useEffect(() => {
    if (!hotelId) return;
    void loadHotelSettings(hotelId);
    void getActiveShift(hotelId).then((shift) => {
      if (shift) setActiveShift(shift);
      else if (useShiftStore.getState().isShiftOpen) clearShift();
    });
  }, [hotelId, setActiveShift, clearShift, loadHotelSettings]);

  async function navigateToTables(depot: Depot) {
    setDepot(depot);
    try {
      await setActiveDepot(hotelId, depot.id);
    } catch {
      /* push routing falls back to all staff */
    }
    router.push("/(main)/tables");
  }

  async function onDepotSelect(depot: Depot) {
    setPendingDepot(depot);
    try {
      const active = await getActiveShift(hotelId);
      if (active) {
        setActiveShift(active);
        await navigateToTables(depot);
        return;
      }
      setShowShiftModal(true);
    } catch (err) {
      Toast.show({ type: "error", text1: "Could not check shift", text2: apiErrorMessage(err) });
    }
  }

  async function startShift(openingFloat: number) {
    if (!pendingDepot) return;
    setShiftBusy(true);
    try {
      const shift = await openShift(hotelId, pendingDepot.id, openingFloat);
      setActiveShift(shift);
      setShowShiftModal(false);
      void hapticSuccess();
      await navigateToTables(pendingDepot);
    } catch (err) {
      void hapticError();
      Toast.show({ type: "error", text1: "Could not open shift", text2: apiErrorMessage(err) });
    } finally {
      setShiftBusy(false);
    }
  }

  function skipShift() {
    if (!pendingDepot) return;
    clearShift();
    setShowShiftModal(false);
    void navigateToTables(pendingDepot);
  }

  const waiterName = user?.username || user?.email || "Waiter";

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 pb-4" style={{ paddingTop: headerPad }}>
        <View className="flex-1">
          <Text allowFontScaling={false} className="text-xl font-bold text-slate-900">{t("selectYourOutlet")}</Text>
          <Text className="text-sm text-slate-500">
            {user?.username || user?.email} · One shift covers all outlets
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <ShiftHeaderBadge />
          <ScreenHeaderActions showSettings showLogout />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text allowFontScaling={false} className="mb-4 text-center text-red-600">{t("loadOutletsError")}</Text>
          <Pressable
            onPress={() => void refetch()}
            className="min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-3"
          >
            <Text allowFontScaling={false} className="font-semibold text-white">{t("retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-4">
          {depots.map((depot) => (
            <OutletCard
              key={depot.id}
              depot={depot}
              productCount={counts[depot.id] ?? 0}
              onPress={() => void onDepotSelect(depot)}
            />
          ))}
          {depots.length === 0 ? (
            <Text allowFontScaling={false} className="text-center text-slate-600">{t("noOutlets")}</Text>
          ) : null}
        </ScrollView>
      )}

      {pendingDepot ? (
        <OpenShiftModal
          visible={showShiftModal}
          depot={pendingDepot}
          waiterName={waiterName}
          busy={shiftBusy}
          requireShift={posRequireShift}
          onStart={(f) => void startShift(f)}
          onSkip={skipShift}
          onClose={() => setShowShiftModal(false)}
        />
      ) : null}
    </View>
  );
}
