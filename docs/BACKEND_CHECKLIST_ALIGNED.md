# HMS Backend Verification Checklist — Aligned to v2.3

**Version:** 2.3-aligned  
**Stack:** Spring Boot 3.4, Hibernate, JWT (HS256), PostgreSQL  
**Last updated:** 2026-04-27  

This document mirrors the **v2.3 QA matrix** and records **implementation status** against the repository. Use it for Postman, MockMvc, and sign-off. When behaviour differs from the narrative examples in v2.3, the **Actual contract** column is authoritative.

**See also:** **`docs/HMS_V1_SPEC_GAP_AND_ROADMAP.md`** — delta vs the broader v1.0 full-stack design (folios, Flyway, Redis, lifecycle jobs, frontend parity) and a prioritized backlog after current API + UI validation.

---

## Legend

| Tag | Meaning |
|-----|---------|
| **Done** | Matches v2.3 intent; payloads may be a subset of the narrative JSON. |
| **Partial** | Endpoint exists; response shape, codes, or scenarios differ — see notes. |
| **Planned** | Not implemented or not exposed. |

---

## Global API conventions (v2.3)

### Error JSON (**Done** — structured envelope)

Business rule failures and validation errors return:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "timestamp": "2026-04-27T12:00:00Z",
  "path": "/api/v1/...",
  "fields": { "fieldName": "constraint message" }
}
```

- `fields` is omitted when empty.  
- `ApiException` uses explicit `error` codes where configured; otherwise a status-derived default (e.g. `BAD_REQUEST`, `FORBIDDEN`).  
- **Method security** (`@PreAuthorize`) **403**: `error` = `FORBIDDEN`, `message` explains denial when available.  
- **Unauthenticated** **401**: `error` = `UNAUTHORIZED`.  
- **Login failure** **401**: `error` = `INVALID_CREDENTIALS`, generic message (no user enumeration).

### Auth headers (hotel vs platform) — unchanged

| Context | Headers |
|---------|---------|
| Hotel APIs `/api/v1/hotels/{hotelId}/**` | `Authorization: Bearer <accessToken>`, `X-Hotel-ID: <same hotelId as path>` (required for non–`SUPER_ADMIN` users). |
| Platform `/api/v1/platform/**` | `Authorization: Bearer <super_admin accessToken>` only — no `X-Hotel-ID`. |

`SUPER_ADMIN` may call hotel routes **without** `X-Hotel-ID` (tenant assertion bypass).

---

## Authentication & session

| # | Endpoint | v2.3 | Status | Actual contract / notes |
|---|----------|------|--------|-------------------------|
| A1 | `POST /api/v1/auth/login` | email/username + password; returns access + refresh + user + `tokenType` | **Done** | Body: `username` **or** `email` (at least one) + `password`. Response: `accessToken`, `refreshToken`, `expiresIn`, `tokenType` (`Bearer`), `user` `{ id, email, username, role, hotelId, permissions }`. |
| A2 | `POST /api/v1/auth/refresh` | refresh token rotation | **Done** | Body: `{ "refreshToken": "..." }`. Returns new `LoginResponse`. Invalid/expired refresh → **401** `REFRESH_TOKEN_INVALID` or `REFRESH_TOKEN_EXPIRED`. |

**Example login (username):**

```json
{ "username": "hoteladmin", "password": "ChangeMe!Strong2" }
```

**Example login (email, when `app_users.email` is set):**

```json
{ "email": "admin.seaside@example.com", "password": "…" }
```

**Initialize / bootstrap:** `BootstrapUserInput` supports optional `email` on `superAdmin` and `hotelAdmin` so seeded users can sign in with email after first deploy.

**Refresh / login security:** Refresh JWT is HS256 with claim `typ=refresh`, separate expiry (`hms.jwt.refresh-expiration-ms`). Rotate on each refresh.

---

## Room management

| # | Endpoint | v2.3 | Status | Notes |
|---|----------|------|--------|-------|
| R1 | `GET /api/v1/hotels/{hotelId}/rooms` | List + filters + pagination | **Partial** | `PagedData.pagination` includes `totalPages`, `hasNext`, `hasPrevious`. Items carry `building`, `lastUpdated`, expanded `RoomTypeSummary` / `ReservationSummary`. No separate “applied filters” metadata object. |
| R2 | `POST /api/v1/hotels/{hotelId}/rooms` | Create room | **Done** | Response: `CreateRoomResponse` — `roomType`, `floor`, `building`, `cleanliness`, `amenities`, `createdAt`, `createdBy`, etc. (`ApiDtos`). |
| R3 | `PATCH /api/v1/hotels/{hotelId}/rooms/{roomId}` | Partial update | **Done** | `PatchRoomResponse`: `previousValues` / `updatedValues` (`RoomLifecycleSnapshot`), `RoomUpdateBroadcast`. |
| R4 | `DELETE /api/v1/hotels/{hotelId}/rooms/{roomId}` | Soft delete | **Done** | |
| R5 | `PATCH /api/v1/hotels/{hotelId}/rooms/{roomId}/status` | Housekeeping | **Partial** | `broadcast` is a string hint, not channel object. |
| R6 | `POST /api/v1/hotels/{hotelId}/rooms/{roomId}/charges` | Folio charge | **Done** | `PostChargeResponse`: `roomNumber`, `quantity`, `type`, `postedBy`, `folio` (`previousTotalPreTax` / `newBalancePreTax`). `inventoryImpact` reserved (null unless wired). |

---

## Reservations & folio

| # | Endpoint | v2.3 | Status | Notes |
|---|----------|------|--------|-------|
| V1 | `GET .../reservations/availability` | Public | **Done** | No auth. |
| V2 | `POST .../reservations` | Create | **Done** | `CreateReservationResponse`: `guest`, `stay`, `pricing`, `cancellation`, `nextSteps`; root `guestId` kept for scripts. |
| V3 | `POST .../reservations/{id}/cancel` | Cancel | **Done** | |
| V4 | `POST .../reservations/{id}/apply-guest-preferences` | Preferences | **Partial** | Compare `GuestDtos.ApplyGuestPreferencesResponse`. |
| V5 | `POST .../reservations/{id}/check-in` | Check-in | **Done** | `CheckInResponse`: `guest`, `payment` (when body has `paymentMethod`), `folio`, `broadcast`, `room` includes `cleanliness`. |
| V6 | `POST .../reservations/{id}/check-out` | Check-out + invoice | **Done** | `invoiceBreakdown`, optional `feedback` / `postCheckout` echoes; `RoomStatusDto` includes `cleanliness`. |
| V7 | `GET .../reservations/{id}/folio` | Folio | **Done** | `FolioResponse`: `guest`, `stay`, `payments` (e.g. synthetic deposit line), `summary` (currency + totals), `actions`, `realtime` hint; `FolioCharge` includes quantity / postedBy / reversible / sku. |

---

## Housekeeping, guests, facilities, inventory, F&B, reports

| Area | Status | Notes |
|------|--------|-------|
| Housekeeping tasks | **Done** | `GET .../housekeeping/tasks` |
| Guest profile / loyalty | **Partial** | DTOs under `GuestDtos`; align Postman with actual JSON. |
| Facilities | **Done** | `charge-to-room` allows `HOTEL_ADMIN` / `MANAGER` (aligned with v2.3 hotel admin testing). |
| Inventory / PO / receive | **Partial** | Core flows implemented; narrative “events” / “audit URLs” not in DTOs. |
| F&B orders | **Partial** | Menu / orders / status / charge-to-room. |
| Reports | **Partial** | Occupancy, guest analytics, realtime dashboard — no CSV/PDF export URLs yet. |

---

## Platform (super admin)

| # | Endpoint | v2.3 | Status | Notes |
|---|----------|------|--------|-------|
| P1 | `GET /api/v1/platform/tenants` | List tenants | **Done** | Text search applied in service when `search` param set (DB-safe). |
| P2 | `POST /api/v1/platform/tenants` | Onboard | **Partial** | Response shape vs v2.3 narrative; Stripe optional. |
| P3 | `GET /api/v1/platform/tenants/{id}/dashboard` | Dashboard | **Done** | |
| P4 | `POST /api/v1/platform/tenants/{id}/impersonate` | Impersonate | **Done** | `X-Impersonate-Token` + super-admin Bearer per `JwtWebAuthSupport`. |
| P5 | `POST /api/v1/platform/hotels` | Create hotel | **Done** | |
| P6 | `GET /api/v1/platform/analytics/revenue` | Revenue | **Done** | |
| P7 | `GET /api/v1/platform/audit/logs` | Audit | **Done** | |

---

## Non-functional (v2.3 targets vs repo)

| Item | v2.3 target | Repo status |
|------|-------------|-------------|
| JWT algorithm | RS256 (checklist) | **HS256** shared secret — `hms.jwt.secret` (documented for dev). |
| Rate limiting login | 429 after N failures | **Planned** |
| OpenAPI | `/v3/api-docs` | **Planned** (add springdoc when desired) |
| WebSocket STOMP | Tenant checks | **Done** | `StompTenantSecurityChannelInterceptor` |

---

## Postman alignment

- Collection: `postman/HMS-Room-Module.postman_collection.json`.  
- **`hotelId`** must stay the Initialize hotel for **`hoteladmin`**; use **`onboardedTenantHotelId`** / **`extraHotelId`** for other properties (see collection description).  
- Login scripts may read `accessToken` unchanged; **`refreshToken`** is now returned for refresh-flow tests.

---

## Sign-off workflow

1. Run **01 Initialize** once; **02** login flows.  
2. For each **Done** row, execute the happy path and one 4xx from the v2.3 scenario list where applicable.  
3. For **Partial** rows, assert on **actual DTOs** in `com.hms.api.dto` — extend DTOs over time to close gaps.  
4. Track **Planned** items in backlog (OpenAPI, rate limit, export URLs, RS256 if required).

---

## Reference classes

| Concern | Location |
|---------|----------|
| REST DTOs | `com.hms.api.dto.ApiDtos`, `PlatformDtos`, `GuestDtos`, … |
| Errors | `com.hms.web.ApiException`, `GlobalExceptionHandler`, `SecurityProblemHandlers` |
| Auth | `com.hms.api.AuthController`, `com.hms.security.JwtService` |
| Tenant guard | `com.hms.security.TenantAccessService` |

---

*End of aligned checklist. Extend tables as new controllers ship.*
