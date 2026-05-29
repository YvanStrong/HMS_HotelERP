# HMS Market Readiness - Execution Status

Last updated: 2026-04-30 (security hardening + checklist pass)

## Module 1 (Dashboard) - Done

### What was implemented

- Added a new backend executive dashboard endpoint:
  - `GET /api/v1/hotels/{hotelId}/reports/executive-dashboard`
- Added dashboard response contracts for:
  - KPI cards (operations, revenue, alerts)
  - arrivals/departures table rows
  - recent activity rows
- Implemented real KPI computations in backend service:
  - occupancy today + tone logic
  - arrivals/departures expected vs completed
  - available rooms + dirty/out-of-order counts
  - revenue today vs yesterday
  - revenue this month
  - outstanding open folio balances
  - housekeeping pending/in-progress and urgent counts
  - stale DND alerts
- Implemented arrivals/departures table data and recent activity feed (last 20 events).
- Rebuilt `/app/dashboard` frontend with:
  - proper enterprise header
  - loading skeletons
  - empty state with action
  - error banner with retry
  - 60-second auto-refresh
  - "Last updated" timestamp
  - KPI rows and arrivals/departures/activity tables

### Files changed in Module 1

- `backend/src/main/java/com/hms/api/ReportController.java`
- `backend/src/main/java/com/hms/service/ReportService.java`
- `backend/src/main/java/com/hms/api/dto/ReportDtos.java`
- `backend/src/main/java/com/hms/repository/ReservationRepository.java`
- `backend/src/main/java/com/hms/repository/PaymentRepository.java`
- `backend/src/main/java/com/hms/repository/HousekeepingTaskRepository.java`
- `backend/src/main/java/com/hms/repository/RoomChargeRepository.java`
- `frontend/src/app/hotels/[hotelId]/dashboard/page.tsx`

### Verification completed

- `mvn -DskipTests compile` passed.
- `npm run build` passed (with pre-existing non-blocking warnings elsewhere).

## Module 2 (Reservations) - Done

### What was implemented

- Enterprise reservations operations board:
  - KPI counters (total, confirmed, checked-in, arrivals today)
  - date/status/search filters with quick presets
  - paginated reservations table with manager-friendly columns
  - availability preview panel
  - loading skeleton rows and empty-state row in the list
  - no-show action moved to confirmation modal flow (no native `confirm()` on list page)
- Reservation detail workspace:
  - front-desk booking summary and timeline
  - folio visibility with charges, payments, and running balance
  - operational actions for check-in, check-out, posting charge, recording payment, invoice/staff-copy print
  - policy-aware check-out gating (status, minibar, room assignment, balance/override checks)
- New reservation operational wizard:
  - multi-step booking flow with draft save/resume
  - guest lookup + full profile capture
  - stay availability preview and room map selection
  - preview and payment/deposit confirmation step
  - post-confirmation actions (open reservation, print/download)
- UUID exposure reduced in staff-facing reservations workflows by prioritizing booking references and confirmation codes.

### Files changed in Module 2

- `frontend/src/app/hotels/[hotelId]/reservations/page.tsx`
- `frontend/src/app/hotels/[hotelId]/reservations/new/page.tsx`
- `frontend/src/app/hotels/[hotelId]/reservations/[reservationId]/page.tsx`

## Module 3 (Guests) - Done

- Rebuilt guests index into an operations list page with:
  - manager-friendly columns (guest, contact, booking, status, room, stay)
  - search + status filtering + pagination
  - loading skeletons, empty states, and refresh action
- Implemented real guest detail workspace with tabs:
  - Profile
  - Stay History
  - Preferences
  - Flags & Communication
- Added staff loyalty actions on guest detail:
  - Earn points
  - Redeem points
  - Inline validation + success/error feedback after API operations
- Replaced placeholder guest-detail experience with operational, data-backed UI.

### Files changed in Module 3

- `frontend/src/app/hotels/[hotelId]/guests/page.tsx`
- `frontend/src/app/hotels/[hotelId]/guests/[guestId]/page.tsx`

## Module 4 (Rooms) - Done

- Completed operational room detail workspace with tabbed sections:
  - Room Info
  - Status History
  - Housekeeping
  - Maintenance
- Added housekeeping actions:
  - DND toggle/save and clear behavior
  - status transition form with required reason
- Added maintenance operations:
  - create maintenance block with reason + until time
  - release active room block directly from room page
- Removed staff-facing raw block UUID exposure from room info display.

### Files changed in Module 4

- `frontend/src/app/hotels/[hotelId]/rooms/[roomId]/page.tsx`

## Module 5 (Room Types) - Done

- Added backend room-type lifecycle endpoints:
  - get room type detail
  - update room type
  - delete room type (with safety check: cannot delete when rooms still reference type)
- Reworked room-type UI flow:
  - list now routes to full detail page
  - detail page includes Rooms tab + Rates tab
  - edit room type modal with save workflow
  - delete room type action with backend validation feedback
- Preserved rate override management via the dedicated rates editor page.

### Files changed in Module 5

- `backend/src/main/java/com/hms/api/dto/ApiDtos.java`
- `backend/src/main/java/com/hms/service/RoomTypeService.java`
- `backend/src/main/java/com/hms/api/RoomTypeController.java`
- `frontend/src/app/hotels/[hotelId]/room-types/page.tsx`
- `frontend/src/app/hotels/[hotelId]/room-types/[roomTypeId]/page.tsx`

## Module 6 (Housekeeping) - Done

- Upgraded housekeeping board UX:
  - top KPI summary bar (pending, in progress, completed, inspected, urgent, DND blocked)
  - improved operational framing and visibility controls
- Replaced prototype interactions:
  - removed `window.prompt` inspection flow
  - added completion modal with checklist/notes
  - added supervisor inspection modal with score validation (1-10)
- Added create-task modal with assignment flow:
  - create task by room, task type, priority
  - optional booking ID + notes
  - optional immediate assignment to housekeeping staff
- Preserved existing assignment/start/complete/inspect/skip-DND actions with cleaner workflow structure.

### Files changed in Module 6

- `frontend/src/app/hotels/[hotelId]/housekeeping/page.tsx`

## Module 7 (Inventory) - Done

- Rebuilt inventory into a tabbed operational workspace:
  - Stock Levels
  - Purchase Orders
  - Suppliers
  - Waste Log
- Added stock operations UX upgrades:
  - KPI summary cards (items, low stock, out of stock, stock value)
  - search/category/low-stock filters with pagination
  - category + item creation forms with validation and disabled-submit states
  - consume stock actions with instant feedback and refresh
- Added supplier operations:
  - create supplier form (name/contact/email/phone)
  - supplier directory list for procurement setup
- Added purchase order workflow in UI:
  - create PO header details (supplier, expected delivery, payment terms, instructions)
  - add/remove PO lines from existing inventory items
  - submit PO and show created PO summary
  - receive goods per PO line and post directly into stock updates
- Added waste/consumption session log view for operational traceability from the inventory workspace.

### Files changed in Module 7

- `frontend/src/app/hotels/[hotelId]/inventory/page.tsx`

## Module 8 (F&B) - Done

- Rebuilt F&B into a tabbed operational workspace:
  - Orders
  - Menu
  - Tables
  - Restaurant Reservations
- Added enterprise order operations:
  - create order workflow with outlet, order type, reservation linking, and line items
  - charge-to-room at order creation with clear validation for checked-in reservation
  - latest order operational panel with status transitions (`IN_PROGRESS`, `READY`, `SERVED`, `CLOSED`)
  - status update flow connected to backend order pipeline with inventory-deduction trigger on close
- Added menu operations:
  - outlet creation form
  - menu item creation form
  - live menu snapshot and outlet list with refresh + pagination
- Added dining-floor operations:
  - tables tab with availability KPIs and table board management
  - restaurant reservations tab with host-style reservation logging and optional linked-stay reference
- Preserved manager-friendly behavior standards (clear labels, validation, non-blocking error/success banners, no prototype prompt/confirm flows).

### Files changed in Module 8

- `frontend/src/app/hotels/[hotelId]/fb/page.tsx`

## Module 9 (Facilities) - Done

- Completed facilities into a true tabbed operational workspace:
  - Operations
  - Settings
  - Maintenance
- Upgraded booking operations UX parity:
  - paginated booking list with search + status filter
  - inline booking actions for cancel and charge-to-room
  - preserved slot calendar, live occupancy counters, booking, and check-in workflows
- Added dedicated maintenance scheduling flow:
  - maintenance title, priority, datetime, duration, and cost capture
  - direct backend submission from the facilities workspace
- Kept manager-friendly standards: validation, loading-safe submit states, clear feedback banners, and scalable lists.

### Files changed in Module 9

- `frontend/src/app/hotels/[hotelId]/facilities/page.tsx`

## Module 10 (Reports) - Done

- Rebuilt reports workspace into enterprise tabs:
  - Executive
  - Occupancy
  - Guest Analytics
  - Night Audit
- Added operational report UX:
  - date-range controls for occupancy
  - paginated occupancy rows, insights, and segments
  - KPI-focused executive cards for operations and revenue
  - night-audit run flow via confirmation modal (removed browser `confirm()`)
- Implemented end-to-end exports (backend + frontend):
  - occupancy CSV/PDF downloads
  - guest analytics CSV/PDF downloads
  - authenticated browser download handling with success/error feedback
- Added backend export endpoints and file responses:
  - `GET /reports/occupancy/export?format=csv|pdf`
  - `GET /reports/guest-analytics/export?format=csv|pdf`
  - proper content-disposition/content-type responses for downloads.

### Files changed in Module 10

- `backend/src/main/java/com/hms/api/ReportController.java`
- `backend/src/main/java/com/hms/service/ReportService.java`
- `frontend/src/app/hotels/[hotelId]/reports/page.tsx`

## Module 11 (Staff) - Done

- Completed full staff lifecycle actions end-to-end:
  - role edit
  - deactivate/reactivate
  - password reset
- Added backend staff lifecycle APIs:
  - `PATCH /staff-users/{userId}/role`
  - `POST /staff-users/{userId}/deactivate`
  - `POST /staff-users/{userId}/reactivate`
  - `POST /staff-users/{userId}/reset-password`
- Added active/inactive account model at persistence layer:
  - `app_users.is_active` with migration and index
  - authentication now blocks deactivated staff accounts at login and refresh
- Upgraded staff UI to manager-grade operations:
  - search + role/status filters + pagination
  - role-change modal
  - password-reset modal
  - deactivate confirmation modal and reactivation action
  - active/inactive status visibility in staff table
- Preserved create-user workflow and role guardrails.

### Files changed in Module 11

- `backend/src/main/resources/db/migration/V12__app_users_active_flag.sql`
- `backend/src/main/java/com/hms/entity/AppUser.java`
- `backend/src/main/java/com/hms/api/dto/ApiDtos.java`
- `backend/src/main/java/com/hms/service/HotelStaffUserService.java`
- `backend/src/main/java/com/hms/api/HotelStaffController.java`
- `backend/src/main/java/com/hms/security/UserPrincipal.java`
- `backend/src/main/java/com/hms/api/AuthController.java`
- `frontend/src/app/hotels/[hotelId]/staff/page.tsx`

## Cross-Cutting Standards To Apply To Every Module

- Header with title + subtitle + primary action.
- Skeleton loading states (no spinner-only UX).
- Empty state with icon/message/action.
- Error banner with retry.
- Remove `confirm()`/`prompt()` and replace with proper modals.
- No raw UUID shown to staff UI.
- Search + filter + pagination on operational lists.
- Form-level inline validation + disabled submit while loading.
- Success and error toast notifications.

## Security / platform hardening (pass 2026-04-30) — Done

- **Login lockout (in-memory):** configurable failed-attempt window + temporary lockout on `POST /api/v1/auth/login` (`LoginAttemptService`, properties `hms.auth.login.*`). Returns HTTP 429 with `LOGIN_TEMP_LOCKED` when locked.
- **Tenant header for super-admin:** `TenantAccessService.assertHotelAccess` now requires `**X-Hotel-ID` matching the URL hotel** for `SUPER_ADMIN` as well, so path hotel IDs cannot be exercised without an explicit header match (aligns with staff clients that derive `X-Hotel-ID` from `/hotels/{hotelId}/...` paths).
- **Guest folio isolation:** `ReservationService.getFolio` denies `ROLE_GUEST` unless the reservation’s guest profile is linked to the signed-in portal account (`portal_account_id`).
- **Structured security audit log (SLF4J):** logger `SECURITY_AUDIT` for login outcomes, folio payments / voids, and staff lifecycle actions (`SecurityAuditService` + `AuthController` / `ReservationService` / `HotelStaffUserService`). Ship logs to your SIEM in production.
- **Production profile:** `application-prod.properties` sets `ddl-auto=validate`, disables OpenAPI/Swagger UI, requires `JWT_SECRET` / `SETUP_TOKEN`, and documents `HMS_CORS_ALLOWED_ORIGIN_PATTERNS`. `**ProductionSecurityGuardrails`** fails startup on unsafe default JWT/setup secrets when `spring.profiles.active=prod`.
- **CORS:** `hms.cors.allowed-origin-patterns` (comma-separated) replaces hard-coded localhost-only patterns in `SecurityConfig`.

### Final checklist (release-oriented)

- Hotel-scoped APIs: `X-Hotel-ID` vs path hotel enforced for all roles including super-admin.
- Guest-facing folio: only the owning portal guest can read the folio.
- Login abuse: basic rate lock on failed password attempts (per identity + client IP).
- Financial writes: folio payment add/void emit audit events; DB remains source of truth for amounts.
- Staff security actions: create user, role change, activate/deactivate, password reset audited (no secrets in logs).
- Prod profile: validate-only DDL, Swagger off, secrets not defaulted in `application-prod.properties`.
- **Multi-instance / edge:** replace in-memory login lockout with Redis or WAF rules; add DB-backed hotel audit if long-term retention is required.

## Next execution order

1. Optional: multi-instance rate limiting + durable hotel-level audit table