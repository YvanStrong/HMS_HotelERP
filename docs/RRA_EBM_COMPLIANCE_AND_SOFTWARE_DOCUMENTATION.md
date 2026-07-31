# HotelERP — RRA EBM CIS Compliance Report & Software Documentation

**Product:** HotelERP (HMS Hotel Management & Inventory / POS)  
**Document date:** 2026-07-30 (updated after compliance gap closure)  
**Related:** `docs/ebm/PHASE0_OFFICIAL_CONFIRMATION.md`, `docs/EBM_INTEGRATION_SPEC.md`

---

## 1. Executive verdict

| Question | Answer |
|---|---|
| Are we at **100%** RRA EBM compliance? | **No** — sandbox live certification still required. |
| Overall weighted CIS compliance (engineering estimate) | **~86%** (was ~58%) |
| Web CIS foundation | **~92%** |
| Production / fiscal go-live readiness | **~55%** (needs sandbox ACK + path confirmation) |
| Can we **apply** for RRA EBM API / sandbox access now? | **Yes** |
| Can we claim certified production fiscalization today? | **No** |

---

## 2. Gap closure status (2026-07-30)

| # | Gap | Status |
|---|---|---|
| 1 | Phase 0 — official guide checked in; fields mapped | **Done (docs)** — live Init still needs RRA credentials |
| 2 | Sandbox E2E with real credentials | **Blocked** — no RRA sandbox TIN/device yet; unit tax tests added |
| 3 | Payload completeness (`taxAmt`, `taxblAmt`, `custTin`, …) | **Done** |
| 4 | Refunds → EBM credit notes (`rcptTyCd=R`) | **Done** |
| 5 | Purchases → EBM purchase on PO complete | **Done** |
| 6 | Fiscal print QR / signature / SDC / MRC | **Done** (when ACK available) |
| 7 | Item master save + persisted code-list UI | **Done** |
| 8 | Manual outbox retry API/UI | **Done** |
| 9 | pos-mini independent EBM | **Deferred** (out of web CIS scope) |

---

## 3. Software documentation (for RRA application)

### Product

HotelERP is a multi-tenant CIS (Spring Boot + Next.js) that integrates with RRA **VSDC** (local WAR) or **OSDC** (cloud) via a durable outbox:

`TRANSACTION → INVOICE → STOCK_IO → STOCK_MASTER` (+ `PURCHASE`, `ITEM_SAVE`).

### Implemented fiscal capabilities

- Device register / Initialize / disable (Settings → EBM)
- Encrypted signing keys; SDC / MRC storage
- Sales from POS, ERP invoices, hotel folio, F&B
- Refunds (POS, ERP sales return, hotel invoice) as `rcptTyCd=R`
- Purchase reporting when PO receipt completes
- OSDC-aligned tax breakdown (A/B, 18% VAT-inclusive split)
- Customer TIN on POS sales
- Item classify + `/saveItem` enqueue; code-list sync persisted + UI
- Manual outbox retry (single + all failed)
- Receipt print with SDC / MRC / receipt no / signature / QR when ACKED

### Configuration

| Setting | Purpose |
|---|---|
| `HMS_EBM_ENABLED` | Master switch (default false) |
| `EBM_KEY_ENCRYPTION_SECRET` | Key encryption |
| `hms.ebm.paths.*` | Override API paths per WAR/OSDC |

Official path notes: `docs/ebm/PHASE0_OFFICIAL_CONFIRMATION.md`.

### Still required for 100% / production

1. RRA sandbox credentials + successful Init  
2. Live E2E ACK on sales / refund / purchase / item save  
3. Path overrides if taxpayer VSDC WAR differs  
4. (Optional later) pos-mini offline CIS  

---

## 4. Draft statement for RRA sandbox application

> HotelERP is a CIS for hotels and retail POS in Rwanda. It implements device Initialization with encrypted keys, ordered outbox submission (transaction before invoice, then stock), refunds as credit notes, purchase save, item master save, code-list sync, fiscal receipt elements (SDC/MRC/QR/signature), and operator retry tooling.  
>  
> Official CIS-for-VSDC and OSDC documentation are on file. We request **sandbox EBM API access** to complete live Init and end-to-end certification. Production fiscalization remains disabled until sandbox acceptance succeeds.

---

## 5. Document control

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-07-30 | Initial scorecard (~58%) |
| 1.1 | 2026-07-30 | Closed implementable gaps; ~86% overall |
