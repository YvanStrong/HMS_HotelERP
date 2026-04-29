# HMS Technical Specification v1.0 — Gap Analysis & Roadmap (This Repo)

**Purpose:** This document is the **missing / partial / different** layer relative to the full *Room Management + Interconnected Modules* specification (v1.0 narrative: Spring Boot + Hibernate + Next.js, April 2026). It complements **`BACKEND_CHECKLIST_ALIGNED.md`** (v2.3 QA matrix): the checklist tracks **what the API does today**; this file tracks **distance from the v1.0 design** so you can implement the remainder after the **current backend + frontend** are validated end-to-end.

**How to use:**  
1. Run **backend** + **frontend** (`frontend/README.md`) and walk critical paths (login → rooms → housekeeping).  
2. Use **Postman** (`postman/HMS-Room-Module.postman_collection.json`) for full-module coverage.  
3. Pick backlog items below by **priority**; when an item is delivered, move it to the checklist or delete the row here.

---

## 1. Executive summary

| Area | v1.0 expectation | This repository (April 2026) |
|------|------------------|------------------------------|
| **Stack** | Spring Boot + Hibernate + PostgreSQL + Next.js | **Done:** Spring Boot 3 + Hibernate + PostgreSQL; **Partial:** Next.js app under `frontend/` (minimal staff UI). |
| **Schema governance** | Flyway migrations only; no manual DDL | **Missing:** `application.properties` documents **Hibernate DDL** (no Flyway migration tree in repo). |
| **Multi-tenancy** | `hotel_id` on tenant data | **Done:** Hotel-scoped entities + `X-Hotel-ID` + `TenantAccessService`. |
| **Folio model** | Dedicated `folios`, `folio_charges`, `payments` | **Partial:** Folio is **computed/read** from `Reservation` + `RoomCharge` + checkout **Invoice**; not the normalized folio/payment schema from §3.4. |
| **Rooms model** | Rich status enum, DND, blocks, status logs, floor plan | **Partial:** `Room` + `RoomStatus` / `CleanlinessStatus`; housekeeping patch; **Missing:** DND fields, `room_blocks`, `room_status_logs`, floor-plan positions, spec’s OCCUPIED/VACANT_CLEAN matrix. |
| **Bookings** | `bookings` + rate plans + room rates + policies | **Partial:** `Reservation` + availability + create/check-in/out/cancel; **Missing:** `rate_plans`, `room_rates`, `cancellation_policies` entities, `PENDING_CONFIRM`, no-show job, OTA external create. |
| **RBAC** | FRONT_DESK, GM, HK roles as in §2 | **Partial:** `Role` enum + `@PreAuthorize` (e.g. HOTEL_ADMIN, RECEPTIONIST, …); **Missing:** 1:1 naming/permission matrix with spec; MFA; account lockout. |
| **Infra** | Redis, RabbitMQ/Kafka, S3, rate limit | **Missing / Planned:** No Redis cache for availability; no message bus; MinIO URLs mocked for invoices; rate limiting not wired. |
| **Notifications** | `notifications` table + schedulers | **Missing:** No first-class notification persistence; no pre-arrival / checkout reminder jobs as specified. |
| **Audit** | `audit_logs` + AOP on writes | **Partial:** `PlatformAuditLog` (platform scope); **Missing:** Hotel-scoped immutable audit per §3.8.2 for all booking/folio mutations. |
| **Compliance** | GDPR erasure, PCI token rules, ISO 27001 | **Partial:** Structured errors, JWT; **Missing:** Erasure API, card storage policy enforcement, formal ISO controls. |
| **API envelope** | `{ success, data, meta, errors }` | **Different:** JSON bodies are **raw DTOs** or **ApiErrorResponse** (`error`, `message`, `path`, `fields`). |
| **Reports** | Unified `/reports/{type}?format=json|csv|pdf` | **Partial:** Hotel report endpoints exist; export formats / Redis KPI cache not as in §9. |

---

## 2. Role mapping (spec §2 → repo)

| Spec role | Repo direction | Gap |
|-----------|----------------|-----|
| SUPER_ADMIN | `ROLE_SUPER_ADMIN` + platform APIs | Align naming/docs only. |
| GENERAL_MANAGER | `ROLE_HOTEL_ADMIN` / `ROLE_MANAGER` split | Spec merges “GM”; repo uses separate roles — document mapping in UI. |
| FRONT_DESK | `ROLE_RECEPTIONIST` (+ overlapping admin roles) | Fine-grained matrix in §2.2 not fully mirrored per endpoint. |
| HOUSEKEEPING_* | `ROLE_HOUSEKEEPING`, `ROLE_HOUSEKEEPING_SUPERVISOR` | **Missing:** “my tasks only” scoping, skip-DND dedicated flow per §5.4. |
| FINANCE | `ROLE_FINANCE` | Night audit / folio close APIs from §5.3 largely **missing**. |
| FB_MANAGER / FB_STAFF | `ROLE_FNB_STAFF`; admin creates outlets/items | Outlet/menu-item **create** APIs added; POS/table flows still subset. |
| GUEST | Limited / planned for self-service | **Missing:** guest portal JWT flows for “own booking / own folio” per spec. |

---

## 3. Data model gaps (spec §3 → entities)

### 3.1 Implemented (conceptual match, names may differ)

| Spec concept | Repo implementation |
|--------------|----------------------|
| Hotels | `Hotel` |
| Room types (subset of columns) | `RoomType` (no bed_type enum, floor_options[], JSONB amenities as in spec) |
| Rooms (subset) | `Room` (soft delete; no `is_dnd`, `current_booking_id` column — link via `Reservation.room`) |
| Reservations / bookings | `Reservation` + `Guest` |
| Charges during stay | `RoomCharge` |
| Invoice at checkout | `Invoice` + `InvoiceLineItem` |
| Housekeeping tasks | Task DTOs / services (not full §3.5.1 column parity) |
| Inventory | `InventoryItem`, categories, PO, stock tx |
| F&B | `FbOutlet`, `MenuItem`, `FbOrder`, lines |
| Facilities | `Facility`, slots, bookings |
| Loyalty (partial) | `LoyaltyTransaction`, guest prefs JSON |
| Platform SaaS (extra) | `PlatformTenant`, billing hooks — beyond single-hotel v1.0 but in repo |

### 3.2 Missing or not as separate tables

| Spec § | Artifact | Status |
|--------|----------|--------|
| 3.1.3 | `room_status_logs` | **Missing** — use events / HK patch; no immutable log table. |
| 3.1.4 | `room_blocks` | **Missing** — OOO / maintenance via room flags only. |
| 3.2.1–3.2.2 | `rate_plans`, `room_rates` | **Missing** — pricing uses `RoomType.baseRate` + request overrides. |
| 3.2.3 | Full `bookings` columns | **Partial** — `Reservation` lacks `folio_id`, `rate_plan_id`, `checked_in_by`, fees, no_show timestamps, etc. |
| 3.2.4 | `booking_guests` | **Missing** — single primary guest on reservation. |
| 3.2.5 | `cancellation_policies` | **Partial** — free-text / code on reservation; no policy engine. |
| 3.3.1 | Full guest CRM | **Partial** — core fields + preferences JSON; not full GDPR / VIP / blacklist surface. |
| 3.4.1–3.4.3 | `folios`, `folio_charges`, `payments` | **Missing** as normalized schema — behavior approximated. |
| 3.6.2 | `minibar_assignments` | **Partial** — `RoomMinibarStock` / restock tasks; not full assignment ledger. |
| 3.8.1 | `notifications` | **Missing**. |
| 3.8.2 | Hotel `audit_logs` | **Missing** (platform audit partial). |

### 3.3 Base entity pattern (spec §7.3)

| Rule | Repo |
|------|------|
| `BaseEntity` (created_by, is_deleted everywhere) | **Partial** — timestamps on many entities; **not** a single `@MappedSuperclass` across all; soft delete on **Room** only (`@SQLRestriction`). |

---

## 4. API surface gaps (spec §5 → actual routes)

Base path in repo: **`/api/v1`** with hotel prefix **`/api/v1/hotels/{hotelId}/...`** (not the shortened `/rooms` from the narrative).

| Spec area | Representative spec path | Repo / notes |
|------------|---------------------------|--------------|
| Rooms list | `GET /rooms` | `GET .../hotels/{hotelId}/rooms` (**Done**) |
| Availability | `GET /rooms/availability` | `GET .../reservations/availability` (**Partial** — path + cache differ) |
| Room DND / block / history | `PATCH .../dnd`, `POST .../block`, `GET .../status-history` | **Missing** |
| Bookings CRUD | `/bookings` | `.../reservations` (**Partial**) |
| Folio | `GET /folios/{id}` | `GET .../reservations/{id}/folio` (**Partial** — id is reservation) |
| Folio void / split / close | §5.3 | **Missing** |
| Night audit | `POST /night-audit/run` | **Missing** (no scheduled ROOM_NIGHT post per §4.1) |
| Housekeeping | §5.4 granular PATCH | **Partial** — aggregated tasks + room status patch |
| Guests CRM | §5.5 full | **Partial** — guest APIs under module 6 DTOs |
| Rates | §5.6 | **Missing** |
| Facilities | §5.7 | **Partial** — `FacilityController` (paths under hotel) |

---

## 5. Guest lifecycle gaps (spec §4)

| Phase | Step | Status |
|-------|------|--------|
| Pre-arrival | Redis-cached availability | **Missing** |
| Pre-arrival | SELECT FOR UPDATE / overbooking guard | **Partial** — transactional pick; no explicit row lock API documented |
| Pre-arrival | Auto-assign T-48h + notifications | **Missing** |
| Arrival | Full check-in orchestration (folio OPEN, HK tasks, audit) | **Partial** — check-in updates reservation + room + digital key DTO; no separate Folio entity |
| Stay | DND + HK skip + welfare job | **Missing** |
| Stay | Minibar assignment → folio_charge auto | **Partial** |
| Departure | Night audit before checkout | **Missing** |
| Departure | Folio close rules, split, void | **Missing** |
| Departure | Invoice PDF in S3 | **Partial** — URL placeholder |
| Post | No-show job, cancellation refunds | **Partial** cancel; **Missing** no-show scheduler + gateway refunds |

---

## 6. Frontend (spec §6 vs `frontend/`)

| Spec | Repo `frontend/` |
|------|------------------|
| Next.js 14 App Router | **Done** (`src/app`). |
| Tailwind + shadcn | **Missing** — minimal CSS in `globals.css`. |
| Zustand + React Query | **Missing** — can add when screens grow. |
| Staff routes (full tree §6.2) | **Partial** — login, rooms list, housekeeping stub. |
| Guest portal `/guest` | **Missing**. |
| Public `/book` engine | **Missing**. |

**Next frontend steps (recommended):**  
1. `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_DEFAULT_HOTEL_ID` (from Initialize) in `.env.local`.  
2. Store `hotelId` + `user.hotelId` from login response in context or `localStorage`.  
3. Add **Reservations** page: availability → create reservation → check-in → folio (read-only).  
4. Add **Error** display parsing `ApiErrorResponse.fields`.  
5. Later: align UI labels with **Role** matrix once backend permissions match spec.

---

## 7. Infrastructure & config (spec §1, §10, §12)

| Item | Status |
|------|--------|
| Redis | **Missing** |
| RabbitMQ / Kafka | **Missing** |
| S3 / MinIO client | **Missing** (URLs mocked) |
| SMTP / SendGrid | **Missing** (not wired for booking confirm) |
| Channel manager / OTA webhook | **Missing** |
| Payment gateway abstraction | **Partial** (Stripe for **platform** tenant billing; not guest folio PCI flow) |
| Config keys §12 | **Partial** — JWT/HMS props exist; not full set (`HMS_NIGHT_AUDIT_CRON`, etc.) |

---

## 8. Prioritized backlog (after “backend + current frontend” sign-off)

Use this as the **implementation order** toward v1.0 compliance (can be re-sliced into sprints).

### P0 — Data integrity & folio truth

1. Introduce **Flyway**; freeze Hibernate as validate/update-off for prod.  
2. Add **`folios` + `folio_charges` (+ `payments`)**; migrate `RoomCharge` writers gradually; keep reservation as aggregate root during transition.  
3. **Night audit** job: idempotent `ROOM_NIGHT` (or equivalent) per occupied night.

### P1 — Rooms & housekeeping parity

4. **`room_status_logs`** + optional **`room_blocks`**.  
5. **DND** (`PATCH .../rooms/{id}/dnd`) + HK routing respect.  
6. Housekeeping **task lifecycle** APIs matching §5.4 (start/complete/inspect/skip-dnd).

### P2 — Booking & revenue

7. **`rate_plans` + `room_rates`**; wire availability to daily rates.  
8. **Cancellation policy** engine + refund hooks (gateway abstraction).  
9. **No-show** scheduled job.

### P3 — Compliance & observability

10. **Hotel `audit_logs`** + AOP or domain events.  
11. **`notifications`** + email/SMS adapters.  
12. **GDPR erasure** endpoint for guests.  
13. Rate limiting + MFA for privileged roles.

### Parallel track — Frontend

14. Complete **staff** flows for everything already in **BACKEND_CHECKLIST_ALIGNED.md** (Done/Partial).  
15. **Guest** and **public book** flows once APIs exist (§5.2 / §6).

---

## 9. Traceability

| Document | Role |
|----------|------|
| `docs/BACKEND_CHECKLIST_ALIGNED.md` | Contract & QA for **current** API (v2.3 narrative). |
| `docs/HMS_V1_SPEC_GAP_AND_ROADMAP.md` (this file) | **Delta** from v1.0 **design** to **repo**; backlog source. |
| `postman/HMS-Room-Module.postman_collection.json` | Executable regression for hotel flows. |

---

## 10. Revision history

| Date | Change |
|------|--------|
| 2026-04-27 | Initial gap analysis + roadmap; aligns with user-supplied v1.0 spec text and known repo layout. |

---

*This is a living engineering document. Update rows when features ship or when the canonical spec version changes.*
