import { API_BASE, getToken } from "@/lib/api";

export type TabularReport = {
  reportType: string;
  hotelId: string;
  fromDate?: string | null;
  toDate?: string | null;
  summary: Record<string, unknown>;
  columns: string[];
  rows: Record<string, unknown>[];
};

export type OccupancyReport = {
  reportType: string;
  summary: Record<string, unknown>;
  data: Record<string, unknown>[];
};

export type GuestDashboard = {
  reportType: string;
  fromDate?: string;
  toDate?: string;
  nationalityDistribution: { nationality: string; count: number; percent: number }[];
  repeatGuestCount: number;
  vipGuestCount: number;
  noShowRatePercent: number;
  averageStayNights: number;
  averageGuestLifetimeValue: number;
  revenuePerGuest: number;
};

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export { defaultRange };

const HOTEL_UUID_IN_API_PATH =
  /^\/api\/v1\/hotels\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/;

function hotelIdForExport(path: string): string | undefined {
  const fromPath = path.match(HOTEL_UUID_IN_API_PATH);
  if (fromPath) return fromPath[1];
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("hms_hotel_id") ?? undefined;
}

export async function downloadReportExport(path: string, filename: string): Promise<void> {
  const token = getToken();
  const hotelId = hotelIdForExport(path);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hotelId ? { "X-Hotel-ID": hotelId } : {}),
      Accept: "*/*",
    },
  });
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function labelColumn(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
