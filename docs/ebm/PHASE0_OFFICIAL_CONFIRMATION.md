# Phase 0 — Official RRA EBM documentation check-in

**Date:** 2026-07-30  
**Status:** Public official PDFs checked into repo; path/field mapping aligned to OSDC examples. Live sandbox credentials still required for Phase 0 *acceptance* (Init against RRA sandbox).

## Official documents (checked in)

| File | Source |
|---|---|
| `docs/ebm/official/CIS_for_VSDC_technical_Specifications.pdf` | https://www.rra.gov.rw/fileadmin/user_upload/CIS_for_VSDC_technical_Specifications_New.pdf |
| `docs/ebm/official/OSDC_documentation_v1.0.1.pdf` | https://www.rra.gov.rw/fileadmin/user_upload/osdc_documentation_v1.0.1_2022-04-08.pdf |

RRA portal: https://www.rra.gov.rw/en/ebm-electronic-billing-machine  
Certification contact (RRA): `cis_sdc_certification@rra.gov.rw`

## Confirmed field mapping (OSDC TrnsSalesSaveWrReq examples)

| HotelERP / CIS field | OSDC / EBM field | Notes |
|---|---|---|
| Device TIN | `tin` | Required |
| Branch | `bhfId` | Default `00` |
| Document no | `invcNo` | Numeric when possible |
| Original (refunds) | `orgInvcNo` | `0` for normal sales |
| Customer TIN | `custTin` | Optional; from POS |
| Customer name | `custNm` | Optional |
| Sale type | `salesTyCd=N` | Normal |
| Receipt type | `rcptTyCd=S` or `R` | Sale / Refund |
| Payment | `pmtTyCd` | 01 cash, 02 card, 03 mobile, 04 credit |
| Status | `salesSttsCd=02` | Approved |
| Dates | `cfmDt`, `salesDt` | `yyyyMMddHHmmss` / `yyyyMMdd` |
| Tax A/B totals | `taxblAmtA/B`, `taxAmtA/B`, `taxRtB=18` | VAT-inclusive split |
| Line tax | `taxblAmt`, `taxAmt`, `totAmt`, `taxTyCd` | Per line |
| Item code | `itemCd`, `itemClsCd` | RRA format |
| Purchase save | `rcptTyCd=P`, path `/insertTrnsPurchase` | On PO complete |
| Item master | path `/saveItem` | Classify / save-to-vsdc |

## Default HTTP paths (`hms.ebm.paths.*`)

| Property | Default | Official OSDC note |
|---|---|---|
| `init` | `/initializer/selectInitInfo` | Confirm per WAR build |
| `sales-transaction` / `sales-invoice` | `/trnsSales/saveSales` | OSDC also documents `/saveTrnsSalesOsdc` — override if needed |
| `stock-io` | `/stock/saveStockItems` | Confirm vs WAR |
| `stock-master` | `/stockMaster/saveStockMaster` | Confirm vs WAR |
| `code-list` | `/code/selectCodes` | |
| `item-class` | `/itemClass/selectItemsClass` | |
| `purchase` | `/insertTrnsPurchase` | From OSDC PDF |
| `item-save` | `/saveItem` | From OSDC PDF |

## Still blocked without RRA sandbox

1. Live Init returning real SDC ID / MRC / signing key  
2. End-to-end ACK of TRANSACTION → INVOICE → STOCK against RRA servers  
3. Final path overrides if the taxpayer’s VSDC WAR differs from defaults  

## How to finish Phase 0 acceptance

1. Email RRA for CIS sandbox credentials + VSDC/OSDC test endpoint.  
2. Register device in **Settings → EBM**, set `HMS_EBM_ENABLED=true`, run **Initialize**.  
3. Override `hms.ebm.paths.*` if Init/sales URLs differ.  
4. Mark remaining `[CONFIRM AGAINST OFFICIAL DOC]` markers in `docs/EBM_INTEGRATION_SPEC.md` resolved once sandbox ACKs succeed.
