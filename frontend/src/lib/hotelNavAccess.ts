import type { AuthUser } from "./auth";
import { isSuperAdmin } from "./auth";
import { userHasAnyPermission, userHasPermission, userHasRole } from "./permissions";

/**
 * Hotel sidebar keys — visibility mirrors backend {@code @PreAuthorize} / Postman folders where possible.
 * Locked entries stay visible; use {@link canAccessHotelNav} for styling.
 */
export type HotelNavKey =
  | "dashboard"
  | "reports"
  | "roomTypes"
  | "rooms"
  | "roomBlocks"
  | "reservations"
  | "invoices"
  | "guests"
  | "staff"
  | "housekeeping"
  | "hkMyTasks"
  | "facilities"
  | "menu"
  | "selfOrders"
  | "inventory"
  | "fb"
  | "settings";

const REALTIME_DASHBOARD_ROLES = [
  "SUPER_ADMIN",
  "HOTEL_ADMIN",
  "MANAGER",
  "RECEPTIONIST",
  "FINANCE",
] as const;

const REPORTS_ROLES = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "FINANCE"] as const;

const ROOM_TYPES_LIST_ROLES = [
  "SUPER_ADMIN",
  "HOTEL_ADMIN",
  "MANAGER",
  "RECEPTIONIST",
  "MAINTENANCE",
  "FINANCE",
] as const;

/** GET /room-types — receptionist allowed without {@code room:*}. */
function canRoomTypes(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (userHasRole(user, ROOM_TYPES_LIST_ROLES)) return true;
  return userHasAnyPermission(user, ["room:read", "room:*", "hotel:*"]);
}

function canRooms(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (userHasRole(user, ["HOUSEKEEPING", "HOUSEKEEPING_SUPERVISOR"])) return true;
  return userHasAnyPermission(user, ["room:read", "room:*", "hotel:*"]);
}

function canReservations(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasAnyPermission(user, ["reservation:*", "reservation:self"]);
}

function canInvoices(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasRole(user, ["HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "FINANCE"]);
}

function canGuests(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (userHasRole(user, ["HOTEL_ADMIN", "MANAGER", "RECEPTIONIST", "FINANCE"])) return true;
  return userHasAnyPermission(user, ["guest:read", "guest:*", "hotel:*"]);
}

function canStaff(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasRole(user, ["HOTEL_ADMIN", "MANAGER"]);
}

function canHousekeeping(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasAnyPermission(user, ["housekeeping:*", "room:status", "hotel:*"]);
}

/** Line housekeeping staff only (not supervisor) — mobile “my tasks” list. */
function canHkMyTasksNav(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.role === "HOUSEKEEPING";
}

function canFacilities(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasAnyPermission(user, [
    "reservation:*",
    "guest:read",
    "guest:self",
    "hotel:*",
    "folio:*",
  ]);
}

function canInventory(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (userHasRole(user, ["HOTEL_ADMIN", "MANAGER", "FINANCE", "FNB_STAFF", "HOUSEKEEPING"])) return true;
  return userHasAnyPermission(user, [
    "hotel:*",
    "billing:*",
    "fb:*",
    "housekeeping:*",
    "folio:*",
    "room:*",
  ]);
}

function canMenu(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (userHasRole(user, ["HOTEL_ADMIN", "MANAGER", "FINANCE", "FNB_STAFF", "RECEPTIONIST"])) return true;
  return userHasAnyPermission(user, ["hotel:*", "fb:*", "inventory:*"]);
}

function canFb(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasPermission(user, "fb:*") || userHasRole(user, ["HOTEL_ADMIN", "MANAGER", "FNB_STAFF"]);
}

function canSettings(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasRole(user, ["HOTEL_ADMIN", "MANAGER"]);
}

function canDashboard(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (canRooms(user) || canHousekeeping(user)) return true;
  return userHasRole(user, REALTIME_DASHBOARD_ROLES);
}

function canRoomBlocks(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasAnyPermission(user, ["room:*", "hotel:*"]) || userHasRole(user, ["HOTEL_ADMIN", "MANAGER", "RECEPTIONIST"]);
}

function canReports(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return userHasRole(user, REPORTS_ROLES) || userHasPermission(user, "report:*");
}

export function canAccessHotelNav(user: AuthUser | null, key: HotelNavKey): boolean {
  switch (key) {
    case "dashboard":
      return canDashboard(user);
    case "reports":
      return canReports(user);
    case "roomTypes":
      return canRoomTypes(user);
    case "rooms":
      return canRooms(user);
    case "roomBlocks":
      return canRoomBlocks(user);
    case "reservations":
      return canReservations(user);
    case "invoices":
      return canInvoices(user);
    case "guests":
      return canGuests(user);
    case "staff":
      return canStaff(user);
    case "housekeeping":
      return canHousekeeping(user);
    case "hkMyTasks":
      return canHkMyTasksNav(user);
    case "facilities":
      return canFacilities(user);
    case "menu":
      return canMenu(user);
    case "selfOrders":
      return canMenu(user);
    case "inventory":
      return canInventory(user);
    case "fb":
      return canFb(user);
    case "settings":
      return canSettings(user);
    default:
      return false;
  }
}

export function navHint(key: HotelNavKey): string {
  const hints: Record<HotelNavKey, string> = {
    dashboard: "Room status board + occupancy grid; also staff with housekeeping or room read access.",
    reports: "Permissions: report:* or roles hotel admin, manager, finance.",
    roomTypes: "GET /room-types: hotel admin, manager, receptionist, maintenance, finance.",
    rooms: "Permission: room:read or room:* (or super admin).",
    roomBlocks: "Courtesy holds / maintenance blocks: admin, manager, receptionist (list); create: admin/manager.",
    reservations: "Permission: reservation:* or reservation:self (availability is public).",
    invoices: "Finance and front office invoices: hotel admin, manager, receptionist, finance.",
    guests: "Guest profile and loyalty routes: receptionist read; finance loyalty earn.",
    staff: "Hotel staff management: hotel admin and manager.",
    housekeeping: "Permission: housekeeping:* or room:status.",
    hkMyTasks: "Housekeeping line staff: tasks assigned to you.",
    facilities: "List facilities: receptionist and reservation-capable roles.",
    menu: "Depot menu sale screen for restaurant/bar/barista products.",
    selfOrders: "Self-service kiosk queue and status updates for guest orders.",
    inventory: "List items: finance, F&B, housekeeping; full write: admin/manager/finance.",
    fb: "Permission: fb:* or F&B staff / manager / admin.",
    settings: "Hotel settings: hotel admin or manager.",
  };
  return hints[key];
}
