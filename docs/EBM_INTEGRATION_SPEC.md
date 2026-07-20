# EBM (Rwanda RRA Electronic Billing Machine) Integration — Spec & Implementation Plan

**Status:** Web (Java backend + frontend) CIS foundation implemented — pos-mini deferred.
**Scope decision:** **Web only for this milestone** — Java backend + hotel settings UI. pos-mini is intentionally out of scope until RRA sandbox credentials are live.
**Disclaimer:** HTTP paths/payload field names follow common EBM 2.1 CIS naming and are configurable via `hms.ebm.paths.*`. Confirm against RRA's official guide before production go-live. Every place that still needs official confirmation is flagged **[CONFIRM AGAINST OFFICIAL DOC]**.

---

## 1. Glossary

| Term | Meaning |
|---|---|
| **EBM** | Electronic Billing Machine — RRA's fiscalization program (VAT compliance). |
| **CIS** | Customer/Client Invoicing System — this is *us* (the HMS backend / pos-mini), the software that talks to the EBM device. |
| **VSDC** | Virtual Sales Data Controller — a locally-deployed WAR service (per business/branch) that signs receipts and holds device keys. Requires reliable LAN connectivity from the CIS to the WAR service. |
| **OSDC** | Online Sales Data Controller — RRA-hosted cloud equivalent of VSDC. Requires the CIS to be permanently online. |
| **TIN** | Taxpayer Identification Number. |
| **SDC ID / MRC No** | Identifiers issued to a specific device during Initialization; used to sign/verify every subsequent call. |
| **`itemCd`** | Mandatory unique item code: `[CountryCode(2)][ProductType(1)][PackagingUnit(2)][QtyUnit(2)][7-digit sequence]`, e.g. `RW2NTBA0000012`. |
| **`lastReqDt`** | Last-request timestamp per data category; sent on every pull so RRA returns only deltas. |
| **Receipt signature** | Cryptographic proof returned by the device per issued receipt; the 24-hour offline rule is measured from the last one issued. |

---

## 2. Regulatory rules → engineering requirements

| # | Rule (as given) | Engineering requirement |
|---|---|---|
| 1 | Invoice must be preceded by a Sales **Transaction** submission, else error 922 | Enforce a two-phase state machine per sale: `TRANSACTION_PENDING → TRANSACTION_ACKED → INVOICE_PENDING → INVOICE_ACKED`. Invoice submission code must refuse to run unless the transaction phase is `ACKED`. |
| 2 | Stock in/out must follow the related sales invoice submission | Stock-IO submission is gated on `INVOICE_ACKED` for sale-driven movements. |
| 3 | Stock master update must follow stock in/out | Stock-master submission is gated on `STOCK_IO_ACKED`. |
| 4 | Track `lastReqDt` per data category, resend it on every pull | Persist a cursor row per (device, category); every scheduled pull job reads-then-updates it inside the same transaction as the HTTP call. |
| 5 | >24h offline after a receipt signature ⇒ VSDC stops issuing receipt numbers; build redundancy | Track `last_signature_at` per device; alert well before 24h; durable outbox with retry/backoff so no data is lost while blocked; ops runbook for restoring connectivity. |
| 6 | Every item needs a unique `itemCd` in the RRA format | Add classification fields to every sellable item model + a per-hotel/per-device 7-digit sequence generator. |
| 7 | All calls authenticated by device keys from Initialization; store securely | One-time Initialization flow per device; keys stored encrypted at rest (not in plaintext columns, not in mobile app storage without OS keystore). |
| 8 | Must be permanently online (OSDC) or maintain reliable LAN to WAR (VSDC) | Deployment decision per install; health-check + alerting; outbox absorbs transient gaps either way. |

---

## 3. Where this plugs into the existing codebase

The repo currently has **four independent "sale" surfaces** that are all potentially EBM-taxable events, plus **two stock-movement models**. This fragmentation is the single biggest structural fact this plan has to deal with — EBM must not be bolted onto each one separately.

| Existing surface | File | Feeds |
|---|---|---|
| Hotel folio checkout | `backend/.../entity/Invoice.java` + `InvoiceLineItem` | Room charges, minibar, F&B posted to room |
| Depot / retail POS sale | `backend/.../entity/DepotSale.java` + `DepotSaleLine` | `mobile-pos` retail/depot channel |
| Standalone ERP sales invoice | `backend/.../entity/InvSalesInvoice.java` + `InvSalesInvoiceItem` | Inventory-extension module (`InvExtService`) |
| F&B order | `backend/.../entity/FbOrder.java` + `FbOrderLine` | Restaurant/bar POS, settles into an invoice/depot sale |
| Stock movement (hotel inventory) | `backend/.../entity/StockTransaction.java` (against `InventoryItem`) | HK/minibar/kitchen consumption |
| Stock movement (ERP inventory) | `InvStockTransfer` (against the separate `Inv*` item model) | ERP depot transfers |
| **pos-mini** (fully offline, no backend link today) | `pos-mini/src/db/schema.ts` → `sales`, `sale_items`, `stock_movements` | Standalone retail shop, own SQLite, zero connectivity to the Java backend |

**Design response:** introduce one small abstraction — a **`TaxableSaleEvent`** (backend) / equivalent local table (pos-mini) — that each of the four sale surfaces emits into on completion. The EBM submission pipeline only ever consumes `TaxableSaleEvent`s; it never touches `Invoice`, `DepotSale`, `InvSalesInvoice`, or `FbOrder` directly. This means adding a new sale channel later doesn't require touching EBM code again.

`mobile-pos` needs **no direct EBM work**: it already relays every sale to the backend via `mobile-pos/src/api/*.ts` (with `offlineQueueStore.ts` as its own transport-level retry queue), so backend-side EBM submission automatically covers it. `pos-mini` has no backend connectivity at all today (confirmed — no `fetch`/`axios`/API client in `pos-mini/src`), so it needs its **own independent EBM device registration and outbox**, sharing only the contract (item code format, DTO shapes, sequencing rules) with the backend implementation, not runtime code.

---

## 4. Architecture

```
                    ┌─────────────────────────┐
                    │   RRA EBM device layer   │
                    │  VSDC (local WAR) / OSDC │
                    └────────────┬─────────────┘
                     device A    │    device B
              ┌──────────────────┴──────────────────┐
              │                                       │
   ┌──────────▼───────────┐                ┌──────────▼───────────┐
   │  HMS Backend (Java)   │                │   pos-mini (Expo/TS) │
   │  ebm/ module          │                │   src/ebm/ module    │
   │  - own SDC/MRC keys   │                │   - own SDC/MRC keys │
   │  - own outbox table   │                │   - own outbox table │
   │  - own lastReqDt cur. │                │   - own cursor table │
   └──────────┬────────────┘                └──────────────────────┘
              │ emits TaxableSaleEvent
   ┌──────────┴─────────────────────────────┐
   │ Invoice │ DepotSale │ InvSalesInvoice │ FbOrder │  (mobile-pos relays here)
   └──────────────────────────────────────────┘
```

Two **independent** device registrations (one per channel), because `pos-mini` cannot assume it will ever see the backend. Both implementations conform to the same **EBM Contract** (§5) so behavior, retry semantics, and `itemCd` format stay identical.

---

## 5. Shared EBM Contract (source of truth, language-agnostic)

Create `docs/ebm/contract.md` (or JSON Schema files under `docs/ebm/schemas/`) defining, independent of language:

1. **Sequencing state machine** — the exact states/transitions from §2 rules 1–3.
2. **`itemCd` algorithm** — deterministic function: `(countryCode="RW", productType, packagingUnit, qtyUnit, sequence) → itemCd`, plus how `sequence` is allocated (per-device monotonic counter, zero-padded to 7 digits).
3. **DTO shapes** for: Initialization request/response, Sales Transaction, Sales Invoice, Stock I/O, Stock Master, Code List pull, `lastReqDt` cursor pull.
4. **Outbox entry shape** — `{id, category, payload, status, attempts, last_error, created_at, submitted_at, acked_at}`.
5. **Error taxonomy** — how error 922 and other rejects map to retry vs. hard-fail vs. alert-human.

Both the Java module and the pos-mini module are hand-written implementations of this one contract — not generated from it initially, but validated against it in code review and integration tests. If `pos-mini`/`mobile-pos`/`frontend` ever move into an npm workspace, the TypeScript side can be extracted into a real shared package (`@hms/ebm-client`) at that point without redesigning anything.

---

## 6. Data model changes

### 6.1 Backend (new Flyway migration, e.g. `V70__ebm_integration.sql`)

```sql
-- Device registration & keys (one row per physical/logical EBM device, e.g. per hotel)
CREATE TABLE ebm_device (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  mode VARCHAR(8) NOT NULL,              -- 'VSDC' | 'OSDC'
  tin VARCHAR(32) NOT NULL,
  branch_id VARCHAR(32),
  device_serial_no VARCHAR(64) NOT NULL,
  sdc_id VARCHAR(64),
  mrc_no VARCHAR(64),
  encrypted_signing_key BYTEA,           -- envelope-encrypted, see §9
  key_version INT NOT NULL DEFAULT 1,
  vsdc_endpoint_url TEXT,                -- WAR service URL for VSDC mode
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING_INIT',
  last_signature_at TIMESTAMPTZ,         -- for the 24h rule
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-category delta-sync cursor (rule 4)
CREATE TABLE ebm_sync_cursor (
  device_id UUID NOT NULL REFERENCES ebm_device(id),
  category VARCHAR(32) NOT NULL,         -- 'ITEM_CLASS' | 'CODE_LIST' | 'CUSTOMER' | ...
  last_req_dt TIMESTAMPTZ,
  PRIMARY KEY (device_id, category)
);

-- Durable outbox (rules 1-3, 5)
CREATE TABLE ebm_outbox (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES ebm_device(id),
  sale_event_id UUID,                    -- FK to taxable_sale_event, nullable for stock/master-only entries
  phase VARCHAR(24) NOT NULL,            -- TRANSACTION | INVOICE | STOCK_IO | STOCK_MASTER
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- PENDING | SENT | ACKED | FAILED
  depends_on_id UUID REFERENCES ebm_outbox(id),  -- enforces the ordering rules
  payload JSONB NOT NULL,
  response JSONB,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  acked_at TIMESTAMPTZ
);
CREATE INDEX idx_ebm_outbox_pending ON ebm_outbox(device_id, status) WHERE status IN ('PENDING','FAILED');

-- Unifying sale abstraction (§3)
CREATE TABLE taxable_sale_event (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  source_type VARCHAR(24) NOT NULL,      -- INVOICE | DEPOT_SALE | INV_SALES_INVOICE | FB_ORDER
  source_id UUID NOT NULL,
  ebm_receipt_no VARCHAR(64),
  ebm_signature TEXT,
  ebm_qr_payload TEXT,
  ebm_status VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- PENDING | SUBMITTED | CONFIRMED | FAILED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_taxable_sale_source ON taxable_sale_event(source_type, source_id);
```

Also add to `InventoryItem` (and the parallel `Inv*` item entity used by `InvSalesInvoice`):

```sql
ALTER TABLE inventory_items
  ADD COLUMN item_cd VARCHAR(20) UNIQUE,
  ADD COLUMN item_cls_cd VARCHAR(16),     -- RRA item classification code
  ADD COLUMN item_ty_cd VARCHAR(4),       -- product type digit
  ADD COLUMN pkg_unit_cd VARCHAR(4),      -- packaging unit code
  ADD COLUMN qty_unit_cd VARCHAR(4);      -- quantity unit code
```

`taxCategory` (A/B/C/D) already exists on `InventoryItem` — reuse it directly for VAT category, no change needed.

### 6.2 pos-mini (new SQLite migration, `SCHEMA_VERSION = 5` in `pos-mini/src/db/schema.ts`)

Mirrors the backend concept at a smaller scale:

```sql
ALTER TABLE products ADD COLUMN item_cd TEXT;
ALTER TABLE products ADD COLUMN item_cls_cd TEXT;
ALTER TABLE products ADD COLUMN pkg_unit_cd TEXT;
ALTER TABLE products ADD COLUMN qty_unit_cd TEXT;

CREATE TABLE ebm_device (
  id TEXT PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'VSDC',
  tin TEXT, sdc_id TEXT, mrc_no TEXT,
  encrypted_signing_key TEXT,   -- stored via expo-secure-store, not plain SQLite column (see §9)
  vsdc_endpoint_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_INIT',
  last_signature_at TEXT
);

CREATE TABLE ebm_sync_cursor (
  category TEXT PRIMARY KEY,
  last_req_dt TEXT
);

CREATE TABLE ebm_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT,                 -- references sales(id)
  phase TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  depends_on_id TEXT,
  payload TEXT NOT NULL,        -- JSON blob
  response TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  acked_at TEXT
);
CREATE INDEX idx_ebm_outbox_pending ON ebm_outbox(status);
```

`pos-mini` already has a `number_sequences(prefix, last_number)` table used for invoice numbering — reuse the exact same mechanism for the `itemCd` 7-digit sequence (`prefix = 'ITEMCD'`), no new counter concept needed.

---

## 7. `itemCd` generation

Single pure function, implemented identically in Java and TS per the contract:

```
itemCd(countryCode: "RW", productTypeCd, pkgUnitCd, qtyUnitCd, seq: number) =
  countryCode + productTypeCd + pkgUnitCd + qtyUnitCd + pad(seq, 7)
```

- `seq` comes from the existing sequence mechanism (`number_sequences` in pos-mini; a `SEQUENCE`/counter row per device in Postgres) — **never** derived from row count or UUID, must be gap-free and monotonic per device as RRA requires.
- Classification codes (`productTypeCd`, `pkgUnitCd`, `qtyUnitCd`, `itemClsCd`) come from RRA's published code list, pulled via the Code List sync (rule 4) and cached locally — **[CONFIRM AGAINST OFFICIAL DOC]** for the exact code-list endpoint/table.
- Generation happens once, at item-creation time, and is immutable afterward (RRA items are not renumbered).

---

## 8. Submission pipeline (state machine)

```
Sale completed (Invoice / DepotSale / InvSalesInvoice / FbOrder settle)
        │
        ▼
  taxable_sale_event created (status PENDING)
        │
        ▼
  ebm_outbox: phase=TRANSACTION  ──POST──▶  EBM device ──ACK──▶ status ACKED
        │ (only after TRANSACTION ACKED)
        ▼
  ebm_outbox: phase=INVOICE      ──POST──▶  EBM device ──ACK──▶ status ACKED, store receipt/signature/QR
        │ (only after INVOICE ACKED, and only if the sale moved stock)
        ▼
  ebm_outbox: phase=STOCK_IO     ──POST──▶  EBM device ──ACK──▶ status ACKED
        │ (only after STOCK_IO ACKED)
        ▼
  ebm_outbox: phase=STOCK_MASTER ──POST──▶  EBM device ──ACK──▶ status ACKED
```

- A background worker (`EbmOutboxProcessor`, scheduled every N seconds) picks the oldest `PENDING`/`FAILED` row **per device** whose `depends_on_id` is `ACKED` (or null), submits it, and advances state. This single ordering rule is what enforces requirements 1–3 without special-casing each phase.
- Failure handling: exponential backoff via `attempts`; error 922 specifically means "transaction not found" — treat as a bug (out-of-order submission), alert immediately rather than silently retrying, since retrying an out-of-order call will never succeed.
- On the customer-facing side, checkout/receipt printing does **not** block on EBM ACK — it prints immediately and reconciles the RRA receipt number/QR onto the stored invoice asynchronously once ACKED (matches how VSDC/OSDC systems are normally operated; blocking checkout on a government API is an availability risk).

---

## 9. Security: device key storage (rule 7)

| Channel | Storage | Notes |
|---|---|---|
| Backend | `ebm_device.encrypted_signing_key` (BYTEA), encrypted with a KMS/envelope key from app config (never the DB itself) | Same pattern as any other secret in `application.properties`/secret manager already used for Stripe keys (`HmsStripeProperties`) — follow that existing convention. |
| pos-mini | `expo-secure-store` (already a dependency) for the raw key material; SQLite only stores non-secret metadata (`sdc_id`, `mrc_no`, status) | Never put the signing key in a plain SQLite column — `expo-secure-store` uses Keychain/Keystore. |

Initialization is a one-time flow per device: operator enters TIN (+ branch, for VSDC the WAR endpoint URL) → app calls Initialization → persists `sdc_id`/`mrc_no`/keys → device status flips `PENDING_INIT → ACTIVE`. Re-running Initialization on an already-`ACTIVE` device should be blocked in the UI (RRA treats re-init as provisioning a device, not a routine op).

---

## 10. Offline & the 24-hour rule (rule 5)

- Track `ebm_device.last_signature_at`, updated every time an `INVOICE` phase gets ACKED with a signature.
- Background health check computes `now() - last_signature_at`; surface a warning banner/notification starting at, say, 18h, and a hard alert at 22h — before the 24h cutoff that stops receipt numbering entirely.
- The outbox itself already tolerates arbitrary offline duration (rows just stay `PENDING`); the 24h rule is a **business/ops** constraint (RRA stops issuing receipts, not a software bug), so the software's job is early warning + a clear operator runbook ("restore connectivity to the WAR service / internet within 24h of the last printed receipt"), not a code workaround.
- For VSDC deployments specifically, recommend redundant network paths to the WAR service (e.g., LAN + LTE failover) — an infra recommendation, not something the app can solve alone.

---

## 11. Delta sync (rule 4)

- `EbmSyncJob` runs per category (`CODE_LIST`, `ITEM_CLASS`, `CUSTOMER`, `NOTICES`, etc.) on a schedule.
- Each run: read `ebm_sync_cursor.last_req_dt` for `(device, category)` → call the pull endpoint with that value → on success, upsert the returned rows and set `last_req_dt = response.currentDate` (or the max timestamp in the response — **[CONFIRM AGAINST OFFICIAL DOC]** which field RRA returns for this) inside the same DB transaction as the upsert, so a crash mid-sync can't skip or duplicate a window.

---

## 12. Phased implementation plan

| Phase | Deliverable | Depends on | Acceptance |
|---|---|---|---|
| **0. Confirm spec** | Obtain RRA's official EBM 2.1 CIS integration guide (endpoint paths, exact payload fields, error codes) and the code-list values for item/packaging/qty-unit classification. Confirm VSDC vs OSDC per hotel. | — | Doc checked into `docs/ebm/official/` (or linked); all `[CONFIRM AGAINST OFFICIAL DOC]` markers in this file resolved. |
| **1. Backend: device registration** | `ebm_device` table + Initialization flow + encrypted key storage + admin UI (hotel settings) to run it. | Phase 0 | Can Initialize a test device against RRA's sandbox and see `status=ACTIVE`. |
| **2. Backend: `itemCd` + classification** | Migration on `InventoryItem` (+ `Inv*` item entity); code-list sync job; `itemCd` generator; admin UI to assign classification per item. | Phase 1 | New item gets a valid, unique `itemCd`; existing items backfilled in a batch job. |
| **3. Backend: `TaxableSaleEvent` + outbox skeleton** | New tables from §6.1; hook `Invoice`, `DepotSale`, `InvSalesInvoice`, `FbOrder` settlement to emit a `TaxableSaleEvent`. | Phase 2 | Every completed sale produces exactly one `taxable_sale_event` row, verified across all four source types. |
| **4. Backend: submission pipeline** | `EbmOutboxProcessor` implementing the TRANSACTION → INVOICE → STOCK_IO → STOCK_MASTER chain; retry/backoff; error-922 alerting. | Phase 3 | A sandbox sale round-trips end-to-end with receipt number/signature stored back on the invoice/receipt print-out. |
| **5. Backend: delta sync + 24h monitor** | `EbmSyncJob` per category; `last_signature_at` health check + alerting. | Phase 4 | Cursor advances correctly across restarts; alert fires in a simulated 18h/22h offline test. |
| **6. pos-mini: mirror phases 1–5 in TS** | `src/db` migration v5, `src/ebm/` module (device init, `itemCd`, outbox, sync), settings screen for Initialization. | Phase 0 (contract), independent of backend phases otherwise | Same acceptance criteria as phases 1–5, run standalone against sandbox with no backend involved. |
| **7. Reporting/audit** | Admin screen(s) showing outbox health, failed submissions, last sync per category, per-device status — both frontend (`hotels/[hotelId]`) and pos-mini settings. | Phases 4–6 | Ops can see and manually retry a stuck submission without touching the DB. |

`mobile-pos` requires no dedicated phase — it is covered automatically once backend phase 4 is live, since all its sales already land in `DepotSale`/`Invoice`/`FbOrder`.

---

## 13. Open questions to resolve before coding (Phase 0)

1. Exact REST paths and payload field names for Initialization, Sales Transaction, Sales Invoice, Stock I/O, Stock Master, and each Code List category.
2. Exact response field RRA uses for the sync cursor (is it `resultDt`, `currentDate`, or per-record `sdcDt`?).
3. Full RRA classification code tables (`itemClsCd`, `pkgUnitCd`, `qtyUnitCd`, `productTypeCd` values) — needed to build the `itemCd` generator and item classification UI.
4. Per-hotel decision: VSDC (local WAR, needs a deployed service + LAN redundancy) vs OSDC (cloud, needs permanent internet) — this determines `ebm_device.mode` and infra work outside this app.
5. Whether receipts/QR codes must be reprinted on paper (thermal printer format) — affects `InvoicePdfService`/`taxInvoiceHtml.ts` and pos-mini's receipt printing (`react-native-thermal-receipt-printer-image-qr` is already an optional dependency in pos-mini, which is a good sign it's anticipated).
6. Sandbox/test credentials and RRA's test environment availability for Phases 1–6 acceptance testing.

---

## 14. File map (what gets created)

**Backend**
- `backend/src/main/resources/db/migration/V70__ebm_integration.sql`
- `backend/src/main/java/com/hms/entity/EbmDevice.java`, `EbmOutboxEntry.java`, `EbmSyncCursor.java`, `TaxableSaleEvent.java`
- `backend/src/main/java/com/hms/ebm/EbmClient.java` (HTTP calls to VSDC/OSDC)
- `backend/src/main/java/com/hms/ebm/EbmOutboxProcessor.java` (scheduled worker)
- `backend/src/main/java/com/hms/ebm/EbmSyncJob.java`
- `backend/src/main/java/com/hms/ebm/ItemCdGenerator.java`
- `backend/src/main/java/com/hms/service/EbmDeviceService.java` (Initialization flow)
- `backend/src/main/java/com/hms/api/EbmController.java` (admin endpoints: init device, view outbox/health)

**pos-mini**
- `pos-mini/src/db/migrations.ts` → add v5 migration
- `pos-mini/src/ebm/client.ts`, `outbox.ts`, `itemCd.ts`, `sync.ts`, `deviceInit.ts`
- `pos-mini/app/(main)/settings/ebm.tsx` (Initialization + health screen)

**Shared**
- `docs/ebm/contract.md` (§5)
- `docs/ebm/official/` (drop the official RRA PDFs/specs once obtained in Phase 0)
