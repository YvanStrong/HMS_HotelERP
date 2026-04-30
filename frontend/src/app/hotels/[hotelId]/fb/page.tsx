"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type Outlet = { id: string; name: string; code?: string; outletType?: string; allowsRoomCharge?: boolean };
type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price?: number;
  available?: boolean;
  dietaryTags?: string[];
};
type MenuResponse = {
  menu?: {
    categories?: Array<{ name?: string; items?: MenuItem[] }>;
  };
};
type ReservationLite = {
  id: string;
  bookingReference?: string;
  status?: string;
  guestName?: string;
  roomNumber?: string;
};
type CreatedOrderResponse = {
  orderId: string;
  orderNumber: string;
  status: string;
  estimatedReadyTime?: string;
  totals?: { subtotal?: number; tax?: number; total?: number };
};
type PatchedOrderResponse = {
  orderId: string;
  previousStatus: string;
  newStatus: string;
};

const PAGE_SIZE = 10;

export default function FbPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [tab, setTab] = useState<"orders" | "menu" | "tables" | "reservations">("orders");
  const [rows, setRows] = useState<Outlet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [outletForm, setOutletForm] = useState({
    name: "",
    code: "",
    outletType: "RESTAURANT",
    allowsRoomCharge: true,
    acceptsReservations: true,
  });
  const [menuForm, setMenuForm] = useState({
    name: "",
    code: "",
    price: "",
    itemKind: "FOOD",
    categoriesCsv: "MAIN",
    description: "",
  });
  const [creatingOutlet, setCreatingOutlet] = useState(false);
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [reservations, setReservations] = useState<ReservationLite[]>([]);
  const [orderLines, setOrderLines] = useState<Array<{ menuItemId: string; quantity: string }>>([{ menuItemId: "", quantity: "1" }]);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [chargeToRoomNow, setChargeToRoomNow] = useState(true);
  const [latestOrder, setLatestOrder] = useState<CreatedOrderResponse | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusToSet, setStatusToSet] = useState("IN_PROGRESS");
  const [orderType, setOrderType] = useState("DINE_IN");
  const [tables, setTables] = useState([
    { code: "T01", seats: 2, status: "AVAILABLE" },
    { code: "T02", seats: 4, status: "AVAILABLE" },
    { code: "T03", seats: 4, status: "AVAILABLE" },
    { code: "T04", seats: 6, status: "AVAILABLE" },
  ]);
  const [tableForm, setTableForm] = useState({ code: "", seats: "2" });
  const [bookingForm, setBookingForm] = useState({
    guestName: "",
    reservationId: "",
    partySize: "2",
    tableCode: "",
    time: "",
    notes: "",
  });
  const [tableBookings, setTableBookings] = useState<
    Array<{ id: string; guestName: string; reservationId?: string; partySize: number; tableCode: string; time: string; notes?: string }>
  >([]);

  const loadOutlets = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    setLoading(true);
    try {
      const json = await apiFetch<Outlet[]>(`/api/v1/hotels/${hotelId}/fb/outlets`);
      setRows(json);
      setPage(1);
      if (!selectedOutletId && json.length > 0) {
        setSelectedOutletId(json[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [hotelId, selectedOutletId]);

  const loadMenu = useCallback(async () => {
    if (!selectedOutletId) {
      setMenuItems([]);
      return;
    }
    setMenuLoading(true);
    try {
      const res = await apiFetch<MenuResponse>(
        `/api/v1/hotels/${hotelId}/fb/outlets/${selectedOutletId}/menu?availableOnly=false`,
      );
      const flat = (res?.menu?.categories ?? []).flatMap((c) => c.items ?? []);
      setMenuItems(flat);
    } catch {
      setMenuItems([]);
    } finally {
      setMenuLoading(false);
    }
  }, [hotelId, selectedOutletId]);

  const loadReservations = useCallback(async () => {
    try {
      const list = await apiFetch<ReservationLite[]>(`/api/v1/hotels/${hotelId}/reservations?status=CHECKED_IN&page=1&pageSize=100`);
      setReservations(Array.isArray(list) ? list : []);
    } catch {
      setReservations([]);
    }
  }, [hotelId]);

  useEffect(() => {
    void loadOutlets();
  }, [loadOutlets]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(rows ?? [], page, PAGE_SIZE),
    [rows, page],
  );

  async function createOutlet(e: React.FormEvent) {
    e.preventDefault();
    if (!outletForm.name.trim() || !outletForm.code.trim()) {
      setError("Outlet name and code are required.");
      return;
    }
    setCreatingOutlet(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/fb/outlets`, {
        method: "POST",
        body: JSON.stringify({
          name: outletForm.name.trim(),
          code: outletForm.code.trim().toUpperCase(),
          outletType: outletForm.outletType,
          description: "",
          allowsRoomCharge: outletForm.allowsRoomCharge,
          acceptsReservations: outletForm.acceptsReservations,
        }),
      });
      setMsg("Outlet created.");
      setOutletForm({
        name: "",
        code: "",
        outletType: "RESTAURANT",
        allowsRoomCharge: true,
        acceptsReservations: true,
      });
      await loadOutlets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create outlet failed");
    } finally {
      setCreatingOutlet(false);
    }
  }

  async function createMenuItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOutletId) {
      setError("Choose an outlet first.");
      return;
    }
    if (!menuForm.name.trim() || !menuForm.code.trim() || !menuForm.price) {
      setError("Menu item name, code, and price are required.");
      return;
    }
    setCreatingMenu(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/fb/outlets/${selectedOutletId}/menu-items`, {
        method: "POST",
        body: JSON.stringify({
          name: menuForm.name.trim(),
          code: menuForm.code.trim().toUpperCase(),
          price: Number(menuForm.price),
          itemKind: menuForm.itemKind,
          categories: menuForm.categoriesCsv
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          description: menuForm.description.trim() || null,
        }),
      });
      setMsg("Menu item created.");
      setMenuForm({
        name: "",
        code: "",
        price: "",
        itemKind: "FOOD",
        categoriesCsv: "MAIN",
        description: "",
      });
      await loadMenu();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create menu item failed");
    } finally {
      setCreatingMenu(false);
    }
  }

  function addOrderLine() {
    setOrderLines((p) => [...p, { menuItemId: "", quantity: "1" }]);
  }

  function removeOrderLine(idx: number) {
    setOrderLines((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== idx)));
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOutletId) {
      setError("Choose outlet for order.");
      return;
    }
    const lines = orderLines
      .map((l) => ({ menuItemId: l.menuItemId, quantity: Number(l.quantity) }))
      .filter((l) => l.menuItemId && !Number.isNaN(l.quantity) && l.quantity > 0)
      .map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, modifiers: [], specialInstructions: null }));
    if (lines.length === 0) {
      setError("Add at least one valid line item.");
      return;
    }
    if (orderType === "ROOM_SERVICE" && !selectedReservationId) {
      setError("Checked-in reservation is required for room service.");
      return;
    }
    setCreatingOrder(true);
    setError(null);
    setMsg(null);
    try {
      const created = await apiFetch<CreatedOrderResponse>(`/api/v1/hotels/${hotelId}/fb/orders`, {
        method: "POST",
        body: JSON.stringify({
          outletId: selectedOutletId,
          type: orderType,
          reservationId: selectedReservationId || null,
          lines,
          payment: chargeToRoomNow
            ? {
                method: "ROOM_CHARGE",
                roomChargeDescription: "F&B order posted from operations workspace",
              }
            : { method: "CASH" },
        }),
      });
      setLatestOrder(created);
      setMsg(`Order ${created.orderNumber} created.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create order failed");
    } finally {
      setCreatingOrder(false);
    }
  }

  async function updateLatestOrderStatus() {
    if (!latestOrder) return;
    setUpdatingStatus(true);
    setError(null);
    setMsg(null);
    try {
      const updated = await apiFetch<PatchedOrderResponse>(`/api/v1/hotels/${hotelId}/fb/orders/${latestOrder.orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: statusToSet,
          timestamp: new Date().toISOString(),
          notes: "Updated from F&B operations board",
          inventoryDeducted: statusToSet === "CLOSED",
        }),
      });
      setLatestOrder((o) => (o ? { ...o, status: updated.newStatus } : o));
      setMsg(`Order status updated: ${updated.previousStatus} -> ${updated.newStatus}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setUpdatingStatus(false);
    }
  }

  function addTable() {
    if (!tableForm.code.trim()) {
      setError("Table code is required.");
      return;
    }
    const seats = Number(tableForm.seats);
    if (Number.isNaN(seats) || seats <= 0) {
      setError("Seats must be positive.");
      return;
    }
    setTables((t) => [...t, { code: tableForm.code.trim().toUpperCase(), seats, status: "AVAILABLE" }]);
    setTableForm({ code: "", seats: "2" });
    setMsg("Table added.");
  }

  function saveRestaurantReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingForm.guestName.trim() || !bookingForm.tableCode || !bookingForm.time) {
      setError("Guest name, table, and reservation time are required.");
      return;
    }
    setTableBookings((b) => [
      {
        id: crypto.randomUUID(),
        guestName: bookingForm.guestName.trim(),
        reservationId: bookingForm.reservationId || undefined,
        partySize: Number(bookingForm.partySize) || 1,
        tableCode: bookingForm.tableCode,
        time: bookingForm.time,
        notes: bookingForm.notes || undefined,
      },
      ...b,
    ]);
    setTables((t) => t.map((tb) => (tb.code === bookingForm.tableCode ? { ...tb, status: "RESERVED" } : tb)));
    setBookingForm({ guestName: "", reservationId: "", partySize: "2", tableCode: "", time: "", notes: "" });
    setMsg("Restaurant reservation logged.");
  }

  const availableTables = tables.filter((t) => t.status === "AVAILABLE").length;
  const reservedTables = tables.filter((t) => t.status === "RESERVED").length;
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">F&amp;B</h1>
        <p className="text-muted-foreground mt-1">Orders, menu, tables, and restaurant reservations in one workspace</p>
      </div>
      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tab === "orders" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("orders")}>Orders</button>
          <button type="button" className={tab === "menu" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("menu")}>Menu</button>
          <button type="button" className={tab === "tables" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("tables")}>Tables</button>
          <button type="button" className={tab === "reservations" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("reservations")}>Restaurant Reservations</button>
        </div>
      </div>

      {tab === "orders" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Outlets</p><p className="text-2xl font-bold">{rows?.length ?? 0}</p></div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Menu items</p><p className="text-2xl font-bold">{menuItems.length}</p></div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Checked-in stays</p><p className="text-2xl font-bold">{reservations.length}</p></div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Latest order</p><p className="text-sm font-semibold">{latestOrder?.orderNumber ?? "—"}</p></div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Create order</h2>
            <form onSubmit={createOrder} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label>Outlet</label>
                  <select value={selectedOutletId} onChange={(e) => setSelectedOutletId(e.target.value)}>
                    <option value="">Choose outlet</option>
                    {(rows ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Order type</label>
                  <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                    <option value="DINE_IN">DINE_IN</option>
                    <option value="ROOM_SERVICE">ROOM_SERVICE</option>
                    <option value="TAKEAWAY">TAKEAWAY</option>
                  </select>
                </div>
                <div>
                  <label>Checked-in reservation</label>
                  <select value={selectedReservationId} onChange={(e) => setSelectedReservationId(e.target.value)}>
                    <option value="">Optional (required for room service)</option>
                    {reservations.map((r) => <option key={r.id} value={r.id}>{r.bookingReference ?? r.id} · {r.guestName ?? "Guest"}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={chargeToRoomNow} onChange={(e) => setChargeToRoomNow(e.target.checked)} />
                    Charge to room now
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 p-3">
                <p className="mb-2 text-sm font-medium">Order lines</p>
                <div className="space-y-2">
                  {orderLines.map((line, idx) => (
                    <div key={`line-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select value={line.menuItemId} onChange={(e) => setOrderLines((prev) => prev.map((p, i) => (i === idx ? { ...p, menuItemId: e.target.value } : p)))}>
                        <option value="">Choose menu item...</option>
                        {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.price ?? 0})</option>)}
                      </select>
                      <input type="number" value={line.quantity} onChange={(e) => setOrderLines((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p)))} placeholder="Quantity" />
                      <button type="button" className="hms-btn-outline text-sm" onClick={() => removeOrderLine(idx)}>Remove</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <button type="button" className="hms-btn-outline text-sm" onClick={addOrderLine}>Add line</button>
                </div>
              </div>
              <div>
                <button type="submit" className="hms-btn-solid" disabled={creatingOrder}>{creatingOrder ? "Creating..." : "Create order"}</button>
              </div>
            </form>
          </div>

          {latestOrder && (
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Latest order: {latestOrder.orderNumber}</h3>
                <p className="text-sm text-muted-foreground">Status: {latestOrder.status}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/50 p-3 text-sm">Subtotal: {latestOrder.totals?.subtotal ?? "—"}</div>
                <div className="rounded-lg border border-border/50 p-3 text-sm">Tax: {latestOrder.totals?.tax ?? "—"}</div>
                <div className="rounded-lg border border-border/50 p-3 text-sm">Total: {latestOrder.totals?.total ?? "—"}</div>
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label>Update status</label>
                  <select value={statusToSet} onChange={(e) => setStatusToSet(e.target.value)}>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="READY">READY</option>
                    <option value="SERVED">SERVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
                <button type="button" className="hms-btn-outline text-sm" disabled={updatingStatus} onClick={() => void updateLatestOrderStatus()}>
                  {updatingStatus ? "Updating..." : "Save status"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "menu" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Create outlet</h2>
          <form onSubmit={createOutlet} className="grid grid-cols-2 gap-3">
            <div><label>Name</label><input value={outletForm.name} onChange={(e) => setOutletForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label>Code</label><input value={outletForm.code} onChange={(e) => setOutletForm((f) => ({ ...f, code: e.target.value }))} /></div>
            <div>
              <label>Type</label>
              <select value={outletForm.outletType} onChange={(e) => setOutletForm((f) => ({ ...f, outletType: e.target.value }))}>
                <option value="RESTAURANT">RESTAURANT</option>
                <option value="BAR">BAR</option>
                <option value="ROOM_SERVICE">ROOM_SERVICE</option>
                <option value="BANQUET">BANQUET</option>
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={outletForm.allowsRoomCharge} onChange={(e) => setOutletForm((f) => ({ ...f, allowsRoomCharge: e.target.checked }))} /> Room charge</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={outletForm.acceptsReservations} onChange={(e) => setOutletForm((f) => ({ ...f, acceptsReservations: e.target.checked }))} /> Reservations</label>
            </div>
            <div className="col-span-2"><button type="submit" className="hms-btn-solid" disabled={creatingOutlet}>{creatingOutlet ? "Creating..." : "Create outlet"}</button></div>
          </form>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Create menu item</h2>
          <form onSubmit={createMenuItem} className="grid grid-cols-2 gap-3">
            <div>
              <label>Outlet</label>
              <select value={selectedOutletId} onChange={(e) => setSelectedOutletId(e.target.value)}>
                <option value="">Choose outlet</option>
                {(rows ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div><label>Name</label><input value={menuForm.name} onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label>Code</label><input value={menuForm.code} onChange={(e) => setMenuForm((f) => ({ ...f, code: e.target.value }))} /></div>
            <div><label>Price</label><input type="number" value={menuForm.price} onChange={(e) => setMenuForm((f) => ({ ...f, price: e.target.value }))} /></div>
            <div><label>Kind</label><select value={menuForm.itemKind} onChange={(e) => setMenuForm((f) => ({ ...f, itemKind: e.target.value }))}><option value="FOOD">FOOD</option><option value="BEVERAGE">BEVERAGE</option><option value="OTHER">OTHER</option></select></div>
            <div><label>Categories CSV</label><input value={menuForm.categoriesCsv} onChange={(e) => setMenuForm((f) => ({ ...f, categoriesCsv: e.target.value }))} /></div>
            <div className="col-span-2"><label>Description</label><input value={menuForm.description} onChange={(e) => setMenuForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="col-span-2"><button type="submit" className="hms-btn-outline" disabled={creatingMenu}>{creatingMenu ? "Creating..." : "Create menu item"}</button></div>
          </form>
        </div>
      </div>
      )}

      {tab === "menu" && rows && (
        <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Outlets</h2>
            <button type="button" className="hms-btn-outline text-sm" onClick={() => void loadOutlets()}>{loading ? "Refreshing..." : "Refresh"}</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Type</th>
                <th>Room charge</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.code ?? "—"}</td>
                  <td>{r.outletType ?? "—"}</td>
                  <td>{r.allowsRoomCharge ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            noun="outlets"
            onPageChange={setPage}
          />
        </div>
      )}

      {tab === "menu" && <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
        <h2 className="text-lg font-semibold mb-2">Menu snapshot</h2>
        {menuLoading ? (
          <p className="text-sm text-muted-foreground">Loading menu...</p>
        ) : menuItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No menu items for selected outlet yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.slice(0, 20).map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.price ?? "—"}</td>
                  <td>{m.available ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>}

      {tab === "tables" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Available</p><p className="text-2xl font-bold text-green-700">{availableTables}</p></div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Reserved</p><p className="text-2xl font-bold text-amber-700">{reservedTables}</p></div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Occupied</p><p className="text-2xl font-bold text-blue-700">{occupiedTables}</p></div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Add table</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label>Table code</label><input value={tableForm.code} onChange={(e) => setTableForm((f) => ({ ...f, code: e.target.value }))} /></div>
              <div><label>Seats</label><input type="number" value={tableForm.seats} onChange={(e) => setTableForm((f) => ({ ...f, seats: e.target.value }))} /></div>
              <div className="flex items-end"><button type="button" className="hms-btn-solid w-full" onClick={addTable}>Add table</button></div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-2">Table board</h2>
            <table>
              <thead><tr><th>Code</th><th>Seats</th><th>Status</th></tr></thead>
              <tbody>
                {tables.map((t) => <tr key={t.code}><td>{t.code}</td><td>{t.seats}</td><td>{t.status}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "reservations" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Create restaurant reservation</h2>
            <form onSubmit={saveRestaurantReservation} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label>Guest name</label><input value={bookingForm.guestName} onChange={(e) => setBookingForm((f) => ({ ...f, guestName: e.target.value }))} /></div>
              <div>
                <label>Linked stay (optional)</label>
                <select value={bookingForm.reservationId} onChange={(e) => setBookingForm((f) => ({ ...f, reservationId: e.target.value }))}>
                  <option value="">None</option>
                  {reservations.map((r) => <option key={r.id} value={r.id}>{r.bookingReference ?? r.id} · {r.guestName ?? "Guest"}</option>)}
                </select>
              </div>
              <div><label>Party size</label><input type="number" value={bookingForm.partySize} onChange={(e) => setBookingForm((f) => ({ ...f, partySize: e.target.value }))} /></div>
              <div>
                <label>Table</label>
                <select value={bookingForm.tableCode} onChange={(e) => setBookingForm((f) => ({ ...f, tableCode: e.target.value }))}>
                  <option value="">Choose table</option>
                  {tables.map((t) => <option key={t.code} value={t.code}>{t.code} ({t.seats} seats)</option>)}
                </select>
              </div>
              <div><label>Time</label><input type="datetime-local" value={bookingForm.time} onChange={(e) => setBookingForm((f) => ({ ...f, time: e.target.value }))} /></div>
              <div><label>Notes</label><input value={bookingForm.notes} onChange={(e) => setBookingForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              <div className="md:col-span-3"><button type="submit" className="hms-btn-solid">Save reservation</button></div>
            </form>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-2">Reservation list</h2>
            {tableBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No restaurant reservations logged yet.</p>
            ) : (
              <table>
                <thead><tr><th>Guest</th><th>Party</th><th>Table</th><th>Time</th><th>Linked stay</th></tr></thead>
                <tbody>
                  {tableBookings.map((b) => (
                    <tr key={b.id}>
                      <td>{b.guestName}</td>
                      <td>{b.partySize}</td>
                      <td>{b.tableCode}</td>
                      <td>{new Date(b.time).toLocaleString()}</td>
                      <td>{b.reservationId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
