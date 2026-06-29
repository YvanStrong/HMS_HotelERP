# HMS Mobile POS — Evidence-Based Audit Report

**Generated:** 2026-06-24  
**Scope:** Sprint 1–4 mobile POS, web POS parity, critical integration checks  
**Rule:** Every item marked COMPLETE, PARTIAL, or FAIL with file path + code snippet. No UNVERIFIED items remain.

---

## Build proof (re-run)

### Backend `mvn compile`

```
[INFO] BUILD SUCCESS
[INFO] Total time:  9.109 s
---EXIT_CODE=0---
```

### Frontend `npx tsc --noEmit`

```
---EXIT_CODE=0---
```

TypeScript error count: **0**

### Mobile `npx tsc --noEmit`

```
---EXIT_CODE=0---
```

TypeScript error count: **0**

---

## Part A — Critical integration checks (10/10 PASS)


| #   | Check                              | Status | File                                                   |
| --- | ---------------------------------- | ------ | ------------------------------------------------------ |
| 1   | Voided lines excluded from invoice | PASS   | `PosTableTicketService.closeTicket` + `isBillableLine` |
| 2   | Discount uses `effectivePrice`     | PASS   | `lineUnitPriceForSale` + V88 column                    |
| 3   | Tip not taxed                      | PASS   | `recalculateTotals` before `setTipAmount`              |
| 4   | Held lines excluded from kitchen   | PASS   | `sendReadyLinesToKitchen` + `toKitchenRow` (fixed)     |
| 5   | Merge preserves round numbers      | PASS   | `mergeTickets` → `line.setRound(newRound)`             |
| 6   | `X-Hotel-ID` on API requests       | PASS   | `mobile-pos/src/api/client.ts` interceptor             |
| 7   | Manager PIN role validation        | PASS   | `PosPinAuthService.authorizeManagerPin`                |
| 8   | Announcement expiry filter         | PASS   | `PosAnnouncementRepository` JPQL                       |
| 9   | Favorites isolated by user + depot | PASS   | `favorites_${userId}_${depotId}`                       |
| 10  | Shift `totalTips` from tickets     | PASS   | `PosShiftService.calculateFromTickets`                 |


Check 4 fix diff (`toKitchenRow`):

```diff
-                .filter(l -> l.getLineStatus() == PosTicketLineStatus.PENDING
-                        || l.getLineStatus() == PosTicketLineStatus.PREPARING
-                        || l.getLineStatus() == PosTicketLineStatus.READY)
+                .filter(l -> {
+                    if (l.isHeld() && l.getLineStatus() == PosTicketLineStatus.PENDING) {
+                        return false;
+                    }
+                    return l.getLineStatus() == PosTicketLineStatus.PENDING
+                            || l.getLineStatus() == PosTicketLineStatus.PREPARING
+                            || l.getLineStatus() == PosTicketLineStatus.READY;
+                })
```

---

## Part B — Previously UNVERIFIED items (now verified)

### Sprint 1

---

#### B1. Mobile auth / session restore

**Status: COMPLETE**

**Path:** `mobile-pos/app/_layout.tsx`, `mobile-pos/src/store/authStore.ts`

```43:58:mobile-pos/app/_layout.tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initLocalStorage();
        purgeStaleLocalData();
        await hydrateApiBaseUrl();
        await restoreSession();
      } finally {
        if (!cancelled) setHydrated();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreSession, setHydrated]);
```

```179:205:mobile-pos/src/store/authStore.ts
  restoreSession: async () => {
    const session = await hydrateAuthFromSecureStore();
    if (!session) return false;

    try {
      const axios = (await import("axios")).default;
      const { getApiBaseUrl } = await import("../api/settings");
      const { data } = await axios.post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>(
        `${getApiBaseUrl()}/api/v1/auth/refresh`,
        { refreshToken: session.refresh },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Client-Type": "mobile",
          },
        },
      );
      await get().setTokens(data.accessToken, data.refreshToken, data.user ?? session.user);
      return true;
    } catch {
      await get().logout();
      return false;
    }
  },
```

```304:328:mobile-pos/src/store/authStore.ts
export async function hydrateAuthFromSecureStore(): Promise<{
  access: string;
  refresh: string;
  user: AuthUser;
} | null> {
  const access = await SecureStore.getItemAsync("hms_access_token");
  const refresh = await SecureStore.getItemAsync("hms_refresh_token");
  const userJson = await SecureStore.getItemAsync(USER_KEY);
  if (!access || !refresh || !userJson) return null;
  try {
    const user = JSON.parse(userJson) as AuthUser;
    if (!user.hotelId) return null;
    return { access, refresh, user };
  } catch {
    return null;
  }
}
```

**Why COMPLETE:** On cold start, app hydrates tokens from SecureStore, refreshes access token via `/api/v1/auth/refresh`, calls `setTokens` (which sets auth state before follow-up API calls), and routes authenticated users to outlets.

**Login path:** `mobile-pos/app/(auth)/login.tsx` calls `login(email, password)` or `pinLogin` → `loginWithTokens` → `setTokens`.

---

#### B2. Outlets / depot picker

**Status: COMPLETE**

**Path:** `mobile-pos/app/(main)/outlets.tsx`

```37:47:mobile-pos/app/(main)/outlets.tsx
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
```

```60:68:mobile-pos/app/(main)/outlets.tsx
  async function navigateToTables(depot: Depot) {
    setDepot(depot);
    try {
      await setActiveDepot(hotelId, depot.id);
    } catch {
      /* push routing falls back to all staff */
    }
    router.push("/(main)/tables");
  }
```

```141:149:mobile-pos/app/(main)/outlets.tsx
        <ScrollView className="flex-1 px-4 py-4">
          {depots.map((depot) => (
            <OutletCard
              key={depot.id}
              depot={depot}
              productCount={counts[depot.id] ?? 0}
              onPress={() => void onDepotSelect(depot)}
            />
          ))}
```

**Why COMPLETE:** Fetches hotel depots from API, renders selectable `OutletCard` list, persists active depot server-side, stores depot in cart store, navigates to tables.

---

#### B3. Tables — open ticket (basic flow)

**Status: COMPLETE**

**Path:** `mobile-pos/app/(main)/tables.tsx`

```216:228:mobile-pos/app/(main)/tables.tsx
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
```

```107:131:mobile-pos/app/(main)/tables.tsx
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
```

**Why COMPLETE:** Table grid loads via `fetchPosTables`, tap on free table → guest count → `openTicketAction` creates server ticket → navigates to menu. Walk-in counter via `goCounter`.

---

#### B4. Menu browse + cart add

**Status: COMPLETE**

**Path:** `mobile-pos/app/(main)/menu/[depotId].tsx`

```82:86:mobile-pos/app/(main)/menu/[depotId].tsx
  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["menu", hotelId, resolvedDepotId],
    queryFn: () => fetchMenuForDepot(hotelId, resolvedDepotId),
    enabled: !!hotelId && !!resolvedDepotId,
  });
```

```219:247:mobile-pos/app/(main)/menu/[depotId].tsx
  async function addToTicket(
    product: DepotProduct,
    note?: string,
    hold?: { isHeld?: boolean; holdCourse?: HoldCourse },
  ) {
    if (!ticketId || !hotelId) {
      addItem(product, note, hold);
      return;
    }
    const line: CartLine = { ... };
    try {
      await addLinesAction(hotelId, ticketId, [line]);
      Toast.show({ type: "success", text1: "Added to ticket", text2: product.productName, visibilityTime: 1200 });
    } catch {
      addItem(product, note);
      Toast.show({ type: "info", text1: "Added to cart", text2: "Will sync when online" });
    }
  }
```

```265:270:mobile-pos/app/(main)/menu/[depotId].tsx
        onAdd={() => {
          if (ticketId) void addToTicket(product);
          else {
            addItem(product);
            Toast.show({ type: "success", text1: "Added", text2: product.productName, visibilityTime: 1200 });
          }
        }}
```

**Why COMPLETE:** Menu loads products per depot; add goes to live ticket via API or local cart store with offline fallback.

---

### Sprint 2

---

#### B5. POS shifts open/close UI

**Status: COMPLETE**

**Path:** `mobile-pos/app/(main)/outlets.tsx`, `mobile-pos/app/(main)/close-shift.tsx`, `mobile-pos/src/api/shifts.ts`

```85:99:mobile-pos/app/(main)/outlets.tsx
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
```

```82:93:mobile-pos/app/(main)/close-shift.tsx
  async function submitClose(withPrint: boolean) {
    if (!shiftId || !summary) return;
    setBusy(true);
    try {
      const result = await closeShift(hotelId, shiftId, closingCash, notes);
      clearShift();
      setClosedSummary(result);
      if (withPrint) {
        setPrintModal(true);
      } else {
        router.replace("/(main)/outlets");
      }
```

```75:85:mobile-pos/src/api/shifts.ts
export async function openShift(
  hotelId: string,
  depotId: string,
  openingFloat: number,
): Promise<PosShiftDTO> {
  const { data } = await apiClient.post<PosShiftDTO>(`/api/v1/hotels/${hotelId}/pos/shifts`, {
    depotId,
    openingFloat,
  });
  return data;
}
```

```107:117:mobile-pos/src/api/shifts.ts
export async function closeShift(
  hotelId: string,
  shiftId: string,
  closingCash: number,
  closingNotes?: string,
): Promise<PosShiftSummaryDTO> {
  const { data } = await apiClient.post<PosShiftSummaryDTO>(
    `/api/v1/hotels/${hotelId}/pos/shifts/${shiftId}/close`,
    { closingCash, closingNotes: closingNotes ?? "" },
  );
  return data;
}
```

**Why COMPLETE:** `OpenShiftModal` on outlet select opens shift with float; `close-shift.tsx` shows live summary, cash reconciliation, calls close API, blocks on open tickets.

---

#### B6. Web voids page

**Status: COMPLETE**

**Path:** `frontend/src/app/hotels/[hotelId]/pos/voids/page.tsx`

```51:73:frontend/src/app/hotels/[hotelId]/pos/voids/page.tsx
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVoidReport(hotelId, range.from, range.to, page - 1, PAGE_SIZE);
      setRows(res.content ?? []);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
      setTotalItems(res.totalElements ?? 0);
    } finally {
      setLoading(false);
    }
  }, [hotelId, range.from, range.to, page]);

  const filtered = useMemo(() => {
    let list = rows;
    if (actionFilter) list = list.filter((r) => r.action === actionFilter);
    const w = waiterFilter.trim().toLowerCase();
    if (w) list = list.filter((r) => (r.waiterName ?? "").toLowerCase().includes(w));
    return list;
  }, [rows, actionFilter, waiterFilter]);
```

```82:112:frontend/src/app/hotels/[hotelId]/pos/voids/page.tsx
  async function exportCsv() {
    const token = getToken();
    const q = new URLSearchParams({ from: range.from, to: range.to, page: "0", size: "5000" });
    const url = `${API_BASE}/api/v1/hotels/${hotelId}/pos/voids?${q}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = (await res.json()) as { content?: PosLineAuditRow[] };
    ...
    a.download = `pos-voids-${range.from}-${range.to}.csv`;
    a.click();
  }
```

**Why COMPLETE:** Paginated void/discount audit report from backend, action + waiter filters, CSV export with `API_BASE`.

---

#### B7. Web shift summary drawer

**Status: COMPLETE**

**Path:** `frontend/src/components/ShiftSummaryDrawer.tsx`, `frontend/src/app/hotels/[hotelId]/pos/shifts/page.tsx`

```27:37:frontend/src/components/ShiftSummaryDrawer.tsx
  useEffect(() => {
    if (!shiftId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    void fetchShiftSummary(hotelId, shiftId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [hotelId, shiftId]);
```

```113:124:frontend/src/components/ShiftSummaryDrawer.tsx
                  {shiftMoney(summary.totalDiscounts) > 0 ? (
                    <div className="flex justify-between text-amber-800">
                      <dt>Discounts</dt>
                      <dd>-{fmt(summary.totalDiscounts)}</dd>
                    </div>
                  ) : null}
                  {shiftMoney(summary.totalTips) > 0 ? (
                    <div className="flex justify-between">
                      <dt>Tips</dt>
                      <dd>{fmt(summary.totalTips)}</dd>
                    </div>
                  ) : null}
```

```8:8:frontend/src/app/hotels/[hotelId]/pos/shifts/page.tsx
import { ShiftSummaryDrawer } from "@/components/ShiftSummaryDrawer";
```

**Why COMPLETE:** Drawer loads shift summary API, displays revenue/cash/card/tips/discounts, paginated ticket list; wired from shifts page via `drawerId` state.

---

### Sprint 4

---

#### B8. Manager analytics screen (mobile)

**Status: COMPLETE**

**Path:** `mobile-pos/app/(main)/manager.tsx`

```95:127:mobile-pos/app/(main)/manager.tsx
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["pos-analytics", hotelId, range.from, range.to],
    queryFn: () => fetchAnalyticsSummary(hotelId, range.from, range.to),
    enabled: !!hotelId && MANAGER_ROLES.has(role) && tab === "analytics",
  });

  const { data: topItems = [] } = useQuery({
    queryKey: ["pos-top-items", hotelId, range.from, range.to],
    queryFn: () => fetchAnalyticsTopItems(hotelId, range.from, range.to, 5),
    enabled: !!hotelId && MANAGER_ROLES.has(role) && tab === "analytics",
  });

  const { data: allTables = [] } = useQuery({
    queryKey: ["manager-tables", hotelId, depots.map((d) => d.id).join(",")],
    queryFn: async () => {
      const rows = await Promise.all(depots.map((d) => fetchPosTables(hotelId, d.id)));
      return depots.flatMap((d, i) => rows[i].map((t) => ({ ...t, depotName: d.name, depotId: d.id })));
    },
    enabled: !!hotelId && depots.length > 0 && MANAGER_ROLES.has(role),
    refetchInterval: 10_000,
  });
```

```317:328:mobile-pos/app/(main)/manager.tsx
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {[
                    { label: "Revenue", value: fmtRwf(analytics.totalRevenue) },
                    { label: "Orders", value: String(analytics.totalOrders) },
                    { label: "Covers", value: String(analytics.totalCovers) },
                    { label: "Avg ticket", value: fmtRwf(analytics.avgTicketValue) },
                  ].map((k) => (
                    <View key={k.label} className="min-w-[46%] flex-1 rounded-xl bg-slate-50 p-3">
                      <Text className="text-xs text-slate-500">{k.label}</Text>
                      <Text className="text-lg font-bold text-indigo-600">{k.value}</Text>
                    </View>
                  ))}
```

**Why COMPLETE:** Role-gated manager screen fetches analytics summary, top items, waiters, live floor tables; date range presets; CSV export via `fetchAnalyticsExportCsv`.

---

#### B9. EOD report / CSV export

**Status: COMPLETE**

**Path:** `mobile-pos/app/(main)/manager.tsx`, `backend/src/main/java/com/hms/api/MobilePosController.java`

```129:157:mobile-pos/app/(main)/manager.tsx
  async function generateEod() {
    setEodLoading(true);
    try {
      const report = await fetchEndOfDayReport(hotelId, toIsoDate(eodDate));
      setEodReport(report);
    } catch (e) {
      Toast.show({ type: "error", text1: "Report failed", text2: String(e) });
    } finally {
      setEodLoading(false);
    }
  }

  async function shareEod(report: EndOfDayReport) {
    const lines = [
      `End of Day — ${report.date}`,
      `Total Revenue: ${fmtRwf(report.totalRevenue)}`,
      `Cash: ${fmtRwf(report.totalCash)} | Card: ${fmtRwf(report.totalCard)} | Room: ${fmtRwf(report.totalRoomCharge)}`,
      `Tips: ${fmtRwf(report.totalTips)}`,
      ...
    ];
    await sharePlainText("End of Day Report", lines.join("\n"));
  }
```

```159:168:mobile-pos/app/(main)/manager.tsx
  async function exportAnalytics() {
    setExportBusy(true);
    try {
      const csv = await fetchAnalyticsExportCsv(hotelId, range.from, range.to);
      await shareCsvFile(`pos-analytics-${range.from}-${range.to}.csv`, csv);
    } catch (e) {
      Toast.show({ type: "error", text1: "Export failed", text2: String(e) });
    } finally {
      setExportBusy(false);
    }
  }
```

**Why COMPLETE:** EOD tab calls `fetchEndOfDayReport` (backend `PosShiftService.endOfDay`); share as plain text; analytics CSV export via dedicated API.

---

#### B10. Web POS analytics page

**Status: COMPLETE**

**Path:** `frontend/src/app/hotels/[hotelId]/pos/analytics/page.tsx`

```82:106:frontend/src/app/hotels/[hotelId]/pos/analytics/page.tsx
  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const d = await fetchPosDepots(hotelId);
      setDepots(d);
      const activeDepot = depotId || undefined;
      const [s, day, hr, top, w, tbl] = await Promise.all([
        fetchPosSummary(hotelId, range.from, range.to, activeDepot),
        fetchPosDaily(hotelId, range.from, range.to, activeDepot),
        fetchPosHourly(hotelId, range.to, activeDepot),
        fetchPosTopItems(hotelId, range.from, range.to, activeDepot, 10),
        fetchPosWaiters(hotelId, range.from, range.to),
        fetchPosTables(hotelId, range.from, range.to, activeDepot),
      ]);
      setSummary(s);
      setDaily(day);
      setHourly(hr);
      setTopItems(top);
      setWaiters(w);
      setTables(tbl);
    } finally {
      setLoading(false);
    }
  }, [hotelId, range.from, range.to, depotId]);
```

**Why COMPLETE:** Full analytics dashboard with summary KPIs, daily/hourly charts, top items, waiter leaderboard, table revenue; depot filter; CSV export URL via `posAnalyticsExportUrl`.

---

#### B11. Web POS kitchen page

**Status: COMPLETE**

**Path:** `frontend/src/app/hotels/[hotelId]/pos/kitchen/page.tsx`

```83:119:frontend/src/app/hotels/[hotelId]/pos/kitchen/page.tsx
  const load = useCallback(async () => {
    if (!hotelId) return;
    const d = await fetchPosDepots(hotelId);
    setDepots(d);
    setBoard(await fetchKitchenBoard(hotelId, depotId || undefined));
  }, [hotelId, depotId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!token || !hotelId) return;

    const client = new Client({
      brokerURL: wsBrokerUrl(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/hotel/${hotelId}/pos/kitchen`, () => void load());
        client.subscribe(`/topic/hotel/${hotelId}/pos/line-ready`, () => void load());
      },
    });
    client.activate();
```

```49:70:frontend/src/app/hotels/[hotelId]/pos/kitchen/page.tsx
  async function run(action: "ready" | "served") {
    setBusy(true);
    try {
      if (action === "ready") await markLineReady(hotelId, ticketId, line.id);
      else await markLineServed(hotelId, ticketId, line.id);
      onDone();
    } finally {
      setBusy(false);
    }
  }
```

**Why COMPLETE:** KDS board with polling + STOMP WebSocket refresh; mark ready/served actions per line.

---

#### B12. Offline queue sync

**Status: COMPLETE**

**Path:** `mobile-pos/src/hooks/useOfflineSync.ts`, `mobile-pos/src/hooks/offlineSync.ts`, `mobile-pos/app/(main)/_layout.tsx`

```11:25:mobile-pos/src/hooks/useOfflineSync.ts
export function useOfflineSync() {
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      useOfflineQueueStore.getState().setOnline(online);
      if (online) {
        void syncOfflineQueue();
      }
    });
```

```137:187:mobile-pos/src/hooks/offlineSync.ts
export async function syncOfflineQueue(): Promise<void> {
  if (syncing) return;
  const store = useOfflineQueueStore.getState();
  if (store.queue.length === 0) return;

  syncing = true;
  store.setSyncing(true);
  const ticketIdMap = { ...store.ticketIdMap };
  ...
    for (const action of queue) {
      if (action.retryCount >= 3) continue;
      try {
        const result = await executeAction(action, ticketIdMap);
        if (result.serverTicketId && action.ticketId?.startsWith("local-")) {
          ticketIdMap[action.ticketId] = result.serverTicketId;
          store.mapTicketId(action.ticketId, result.serverTicketId);
          ...
        }
        store.dequeue(action.id);
        synced++;
      } catch (err) {
        if (isStaleOfflineConflict(err)) {
          store.dequeue(action.id);
          ...
```

**Why COMPLETE:** NetInfo listener triggers queue sync on reconnect; `executeAction` replays OPEN_TICKET, ADD_LINES, SEND_KITCHEN, CLOSE_TICKET; maps local ticket IDs; drops stale 409 conflicts; max 3 retries.

---

#### B13. Push notifications

**Status: PARTIAL**

**Path:** `mobile-pos/src/notifications/setup.ts`, `mobile-pos/app/_layout.tsx`, `mobile-pos/src/notifications/platform.ts`

```4:6:mobile-pos/src/notifications/platform.ts
export function notificationsSupported(): boolean {
  return Constants.appOwnership !== "expo";
}
```

```70:91:mobile-pos/app/_layout.tsx
  useEffect(() => {
    if (!isAuthenticated) return;
    const hotelId = useAuthStore.getState().user?.hotelId;
    if (!hotelId) return;

    if (!notificationsSupported()) return;

    let detach: (() => void) | undefined;
    void import("../src/notifications/setup")
      .then(async (m) => {
        if (!m.registerPushToken) return;
        await m.registerPushToken(hotelId);
        detach = m.attachNotificationListeners(router, (opts) => Toast.show(opts));
      })
```

```66:94:mobile-pos/src/notifications/setup.ts
export async function registerPushToken(hotelId: string): Promise<void> {
  if (!(await pushSupported())) return;
  ...
    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    const platform = Platform.OS === "ios" ? "ios" : "android";

    await apiClient.post(`/api/v1/hotels/${hotelId}/staff/push-token`, {
      token,
      deviceId: deviceId(),
      platform,
    });
```

**Why PARTIAL (not FAIL):** Full registration flow exists (permissions → Expo push token → `POST /staff/push-token` → listeners for LINE_READY). Intentionally disabled in Expo Go (`notificationsSupported()` returns false). Requires EAS dev/production build + `extra.eas.projectId` in `app.json` per README. Backend table `staff_push_tokens` (V83) exists.

**Gap:** Not exercisable in Expo Go; push delivery not runtime-tested in this audit.

---

#### B14. Multi-language (en/fr)

**Status: PARTIAL**

**Path:** `mobile-pos/src/i18n/index.ts` (infra), multiple screens

```26:35:mobile-pos/src/i18n/index.ts
void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
```

**Translated screens (grep `useTranslation`):** outlets, tables, kitchen, menu, ticket, printer-settings, OpenShiftModal, TablePicker, main tab layout.

**Not translated (hardcoded English):**

- `mobile-pos/src/components/VoidDiscountModal.tsx` — no `useTranslation`; strings like `"Item voided"`, `"Reason required"`
- `mobile-pos/src/components/PaymentModal.tsx` — no `useTranslation`; tip/payment labels
- `mobile-pos/app/(main)/manager.tsx` — `"Manager"`, `"Revenue"`, EOD labels
- `mobile-pos/app/(main)/close-shift.tsx` — shift close UI strings

**Why PARTIAL:** i18n infrastructure + core waiter screens use `t()`. Payment, void/discount, manager, and close-shift modals remain English-only.

---

## Part C — Previously verified items (reference)


| Feature                            | Status   | Primary path                              |
| ---------------------------------- | -------- | ----------------------------------------- |
| X-Hotel-ID header                  | COMPLETE | `mobile-pos/src/api/client.ts`            |
| Voided lines excluded from invoice | COMPLETE | `PosTableTicketService.closeTicket`       |
| Discount → effectivePrice          | COMPLETE | `lineUnitPriceForSale`                    |
| Tip not taxed                      | COMPLETE | `closeTicket` after `createSale`          |
| Held lines excluded from kitchen   | COMPLETE | `sendReadyLinesToKitchen`, `toKitchenRow` |
| Merge round preservation           | COMPLETE | `mergeTickets`                            |
| Manager PIN roles                  | COMPLETE | `PosPinAuthService`                       |
| Announcement expiry                | COMPLETE | `PosAnnouncementRepository`               |
| Favorites user+depot key           | COMPLETE | `favorites.ts`                            |
| Shift totalTips                    | COMPLETE | `PosShiftService.calculateFromTickets`    |
| VoidDiscountModal                  | COMPLETE | `VoidDiscountModal.tsx`                   |
| Ticket void flow                   | COMPLETE | `ticket/[ticketId].tsx`                   |
| Kitchen ALL SERVED                 | COMPLETE | `kitchen.tsx` `markAllServed`             |
| Table transfer                     | COMPLETE | `transferMut`                             |
| Table merge                        | COMPLETE | `mergeMut` + backend                      |
| Reservation hint                   | COMPLETE | `tables.tsx` + `ReservationHintBanner`    |
| Tips UI                            | COMPLETE | `PaymentModal.tsx`                        |
| Announcements                      | COMPLETE | `AnnouncementBannerStack`                 |
| Hold items                         | COMPLETE | `cartStore`, ticket screen                |
| Allergens                          | COMPLETE | `MenuItemCard.tsx`                        |
| Favorites                          | COMPLETE | `menu/[depotId].tsx`                      |
| Reprint last receipt               | COMPLETE | `printer-settings.tsx`, `lastReceipt.ts`  |


---

## Part D — Final evidence-based completion

### Per-sprint scorecard


| Sprint                                | COMPLETE | PARTIAL | FAIL  | Total  | % (COMPLETE only) | % (COMPLETE + ½×PARTIAL) |
| ------------------------------------- | -------- | ------- | ----- | ------ | ----------------- | ------------------------ |
| Sprint 1 — Core waiter flow           | 8        | 0       | 0     | 8      | **100%**          | **100%**                 |
| Sprint 2 — Shifts, voids, audit       | 6        | 0       | 0     | 6      | **100%**          | **100%**                 |
| Sprint 3 — Transfer, tips, hold, etc. | 8        | 0       | 0     | 8      | **100%**          | **100%**                 |
| Sprint 4 — Manager, web, polish       | 5        | 2       | 0     | 7      | **71%**           | **86%**                  |
| **Overall**                           | **27**   | **2**   | **0** | **29** | **93%**           | **97%**                  |


### Sprint 1 detail (8/8 COMPLETE)


| #   | Feature                       | Status   |
| --- | ----------------------------- | -------- |
| 1   | Mobile auth + session restore | COMPLETE |
| 2   | Outlets / depot picker        | COMPLETE |
| 3   | Tables open ticket            | COMPLETE |
| 4   | Menu browse + cart add        | COMPLETE |
| 5   | Send to kitchen (held split)  | COMPLETE |
| 6   | Payment close                 | COMPLETE |
| 7   | Kitchen ALL SERVED            | COMPLETE |
| 8   | X-Hotel-ID on API             | COMPLETE |


### Sprint 2 detail (6/6 COMPLETE)


| #   | Feature                   | Status   |
| --- | ------------------------- | -------- |
| 1   | Void + manager PIN        | COMPLETE |
| 2   | Discount + effectivePrice | COMPLETE |
| 3   | pos_line_audit (V88)      | COMPLETE |
| 4   | Shift open/close UI       | COMPLETE |
| 5   | Web voids page            | COMPLETE |
| 6   | Web shift summary drawer  | COMPLETE |


### Sprint 3 detail (8/8 COMPLETE)


| #   | Feature          | Status   |
| --- | ---------------- | -------- |
| 1   | Table transfer   | COMPLETE |
| 2   | Table merge      | COMPLETE |
| 3   | Tips (not taxed) | COMPLETE |
| 4   | Hold items       | COMPLETE |
| 5   | Allergens        | COMPLETE |
| 6   | Favorites        | COMPLETE |
| 7   | Announcements    | COMPLETE |
| 8   | Reservation hint | COMPLETE |


### Sprint 4 detail (5 COMPLETE, 2 PARTIAL, 0 FAIL)


| #   | Feature                    | Status      |
| --- | -------------------------- | ----------- |
| 1   | Reprint last receipt       | COMPLETE    |
| 2   | Multi-language en/fr       | **PARTIAL** |
| 3   | Manager analytics (mobile) | COMPLETE    |
| 4   | EOD report + CSV export    | COMPLETE    |
| 5   | Web analytics page         | COMPLETE    |
| 6   | Web kitchen page           | COMPLETE    |
| 7   | Offline queue sync         | COMPLETE    |
| 8   | Push notifications         | **PARTIAL** |


### Critical integration checks

**10 / 10 PASS** (see Part A)

### Build gate


| Target                  | Result        |
| ----------------------- | ------------- |
| Backend `mvn compile`   | BUILD SUCCESS |
| Frontend `tsc --noEmit` | 0 errors      |
| Mobile `tsc --noEmit`   | 0 errors      |


### Remaining gaps (PARTIAL only)

1. **i18n** — Wire `useTranslation` into `VoidDiscountModal`, `PaymentModal`, `manager.tsx`, `close-shift.tsx`.
2. **Push** — Verify on EAS build with `projectId`; document that Expo Go is unsupported by design.

### UNVERIFIED count

**0** — every audited feature has file evidence and a COMPLETE / PARTIAL / FAIL label.

---

## Database migrations (POS-relevant, V80–V94)


| Migration | Purpose                          |
| --------- | -------------------------------- |
| V80       | Mobile POS tables + metadata     |
| V81       | Waiter/cashier roles             |
| V82       | pos_table_tickets phase 3        |
| V83       | staff_push_tokens                |
| V84       | app_users pos_pin                |
| V85       | active_depot                     |
| V86       | create pos_shifts                |
| V87       | one shift per waiter/hotel       |
| V88       | voids, discounts, pos_line_audit |
| V89       | hotels.pos_require_shift         |
| V90       | low stock threshold              |
| V91       | tips on tickets + shifts         |
| V92       | pos_announcements                |
| V93       | allergens, hold lines            |
| V94       | seed super admin                 |


**Latest migration:** `V94__seed_super_admin_user.sql`